require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const { initializeGcpClients } = require('./services/gcp/auth');
const { auditStorageBuckets } = require('./services/gcp/auditors/storageAuditor');
const { auditVMs } = require('./services/gcp/auditors/vmAuditor');
const { auditIAM } = require('./services/gcp/auditors/iamAuditor');
const { auditCloudSQL } = require('./services/gcp/auditors/sqlAuditor');
const { auditNetworking } = require('./services/gcp/auditors/networkingAuditor');
const { auditBigQuery } = require('./services/gcp/auditors/bigqueryAuditor');
const { auditKMS } = require('./services/gcp/auditors/kmsAuditor');
const { auditApiKeys } = require('./services/gcp/auditors/apiKeysAuditor');
const { auditEssentialContacts } = require('./services/gcp/auditors/essentialContactsAuditor');
const { auditDns } = require('./services/gcp/auditors/dnsAuditor');
const { auditLogging } = require('./services/gcp/auditors/loggingAuditor');
const { auditDataproc } = require('./services/gcp/auditors/dataprocAuditor');
const { auditGKE } = require('./services/gcp/auditors/gkeAuditor');
const { auditServerless } = require('./services/gcp/auditors/serverlessAuditor');
const { auditLoadBalancers } = require('./services/gcp/auditors/lbAuditor');
const { auditNetworkingDepth } = require('./services/gcp/auditors/networkingDepthAuditor');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-local-key-for-jwt';
const prisma = new PrismaClient();

// Middleware - CORS for Cloud Run
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const reportRoutes = require('./routes/reports');
const scheduleRoutes = require('./routes/schedules');
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/schedules', scheduleRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Security Audit API is running.' });
});

// Middleware to protect routes and extract user
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};

// GCP Comprehensive Scan Route
app.post('/api/scan/gcp', authenticateToken, async (req, res) => {
  console.log("--- Received COMPREHENSIVE LIVE GCP Scan Request ---");

  let credentials = null;

  try {
    if (req.file) {
      credentials = JSON.parse(req.file.buffer.toString('utf8'));
    } else if (req.body && req.body.credentials) {
      credentials = JSON.parse(req.body.credentials);
    } else {
      return res.status(400).json({ error: "Missing GCP credentials (file or JSON body required)." });
    }

    const clients = initializeGcpClients(credentials);
    const gcpProjectId = clients.projectId;

    console.log(`[Engine] Beginning comprehensive audit for Project: ${gcpProjectId}`);

    // Execute auditors in chunks sequentially to prevent Cloud Run OOM errors
    const chunk1Results = await Promise.allSettled([
      auditStorageBuckets(clients.storageClient, gcpProjectId),
      auditVMs(clients.computeClient, clients.projectClient, gcpProjectId),
      auditIAM(clients.googleAuthClient, gcpProjectId),
      auditCloudSQL(clients.googleAuthClient, gcpProjectId)
    ]);
    
    const chunk2Results = await Promise.allSettled([
      auditNetworking(clients.networksClient, clients.firewallsClient, clients.subnetworksClient, clients.backendServicesClient, gcpProjectId),
      auditBigQuery(clients.bigQueryClient, gcpProjectId),
      auditKMS(clients.googleAuthClient, gcpProjectId),
      auditApiKeys(clients.googleAuthClient, gcpProjectId)
    ]);
    
    const chunk3Results = await Promise.allSettled([
      auditEssentialContacts(clients.googleAuthClient, gcpProjectId),
      auditDns(clients.googleAuthClient, gcpProjectId),
      auditLogging(clients.googleAuthClient, gcpProjectId),
      auditDataproc(clients.googleAuthClient, gcpProjectId)
    ]);
    
    const chunk4Results = await Promise.allSettled([
      auditGKE(clients.googleAuthClient, gcpProjectId),
      auditServerless(clients.googleAuthClient, gcpProjectId),
      auditLoadBalancers(clients.googleAuthClient, gcpProjectId),
      auditNetworkingDepth(clients.googleAuthClient, gcpProjectId)
    ]);

    const results = [
      ...chunk1Results,
      ...chunk2Results,
      ...chunk3Results,
      ...chunk4Results
    ];

    // Consolidate findings from successfully resolved auditor promises
    let allFindings = [];
    let totalScanned = 0;
    let allScannedResources = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allFindings = allFindings.concat(result.value.findings || []);
        totalScanned += (result.value.scannedCount || 0);
        if (result.value.scannedResourceList) {
          allScannedResources = allScannedResources.concat(result.value.scannedResourceList);
        }
      } else {
        console.error(`[Engine] Auditor at index ${index} completely failed:`, result.reason);
      }
    });

    // Calculate security score: percentage of secured (zero-finding) resources
    const criticalCount = allFindings.filter(f => f.severity === 'Critical').length;
    const highCount = allFindings.filter(f => f.severity === 'High').length;
    const mediumCount = allFindings.filter(f => f.severity === 'Medium').length;

    // Calculate the number of unique resources that have vulnerabilities
    const vulnerableResourceNames = new Set(allFindings.map(f => f.resource));
    const uniqueVulnerableResources = vulnerableResourceNames.size;

    // Secured resources = resources scanned that have zero vulnerability findings
    const securedResourcesList = allScannedResources.filter(r => !vulnerableResourceNames.has(r.name));

    // Score = (Secured Resources / Total Scanned) × 100
    let computedScore = 100;
    if (totalScanned > 0) {
      computedScore = Math.round(((totalScanned - uniqueVulnerableResources) / totalScanned) * 100);
      computedScore = Math.max(0, computedScore);
    }

    // --- DATABASE PERSISTENCE ---
    const projectName = gcpProjectId || 'GCP Project';

    let project = await prisma.project.findFirst({
      where: { name: projectName, userId: req.user.userId, provider: 'gcp' }
    });

    if (!project) {
      project = await prisma.project.create({
        data: { name: projectName, provider: 'gcp', userId: req.user.userId, credentials: JSON.stringify(credentials) }
      });
    } else {
      // Update credentials for future automation
      await prisma.project.update({
        where: { id: project.id },
        data: { credentials: JSON.stringify(credentials) }
      });
    }

    const scanRecord = await prisma.scanHistory.create({
      data: {
        score: computedScore,
        scannedResources: totalScanned,
        criticalCount,
        highCount,
        mediumCount,
        findings: JSON.stringify(allFindings),
        passedResources: JSON.stringify(securedResourcesList),
        projectId: project.id
      }
    });

    const liveResults = {
      success: true,
      projectId: gcpProjectId,
      dbScanId: scanRecord.id,
      dbProjectId: scanRecord.projectId,
      summary: {
        score: computedScore,
        scannedResources: totalScanned,
        critical: criticalCount,
        high: highCount,
        medium: mediumCount
      },
      vulnerabilities: allFindings,
      passedResources: securedResourcesList
    };

    console.log(`[Engine] Scan complete. Saved to DB (Scan ID: ${scanRecord.id}).`);
    res.status(200).json(liveResults);

  } catch (error) {
    console.error("[Engine] Scanner crashed:", error);
    res.status(500).json({ error: error.message || "Internal server error during GCP scan." });
  }
});

// AWS Comprehensive Scan Route — 81 Checkpoints across 14 auditors
const { auditAwsIam, auditAwsEc2, auditAwsVpc, auditAwsCloudTrail, auditAwsSecurityServices, auditAwsS3, auditAwsRds, auditAwsEks, auditAwsLb, auditAwsKms, auditAwsServerless, auditAwsRoute53, auditAwsRedshift, auditAwsEmr } = require('./services/awsScanner');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

app.post('/api/scan/aws', authenticateToken, async (req, res) => {
  console.log("--- Received COMPREHENSIVE LIVE AWS Scan Request ---");

  try {
    const { accessKeyId, secretAccessKey, region } = req.body;

    if (!accessKeyId || !secretAccessKey) {
      return res.status(400).json({ error: "Missing AWS credentials (accessKeyId, secretAccessKey required)." });
    }

    const credentials = { accessKeyId, secretAccessKey, region: region || 'us-east-1' };
    const maskedKeyId = accessKeyId.substring(0, 4) + '...';
    console.log(`[Engine] Beginning comprehensive AWS audit for Access Key: ${maskedKeyId}`);

    // Execute auditors in sequential chunks to prevent Cloud Run OOM
    const chunk1Results = await Promise.allSettled([
      auditAwsIam(credentials),
      auditAwsEc2(credentials),
      auditAwsVpc(credentials),
      auditAwsCloudTrail(credentials)
    ]);
    
    const chunk2Results = await Promise.allSettled([
      auditAwsSecurityServices(credentials),
      auditAwsS3(credentials),
      auditAwsRds(credentials),
      auditAwsEks(credentials)
    ]);
    
    const chunk3Results = await Promise.allSettled([
      auditAwsLb(credentials),
      auditAwsKms(credentials),
      auditAwsServerless(credentials),
      auditAwsRoute53(credentials)
    ]);
    
    const chunk4Results = await Promise.allSettled([
      auditAwsRedshift(credentials),
      auditAwsEmr(credentials)
    ]);

    const results = [
      ...chunk1Results,
      ...chunk2Results,
      ...chunk3Results,
      ...chunk4Results
    ];

    let allFindings = [];
    let totalScanned = 0;
    let allScannedResources = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allFindings = allFindings.concat(result.value.findings || []);
        totalScanned += (result.value.scannedCount || 0);
        if (result.value.scannedResourceList) {
          allScannedResources = allScannedResources.concat(result.value.scannedResourceList);
        }
      } else {
        console.error(`[Engine] AWS Auditor at index ${index} failed:`, result.reason);
      }
    });

    const criticalCount = allFindings.filter(f => f.severity === 'Critical').length;
    const highCount = allFindings.filter(f => f.severity === 'High').length;
    const mediumCount = allFindings.filter(f => f.severity === 'Medium').length;

    const vulnerableResourceNames = new Set(allFindings.map(f => f.resource));
    const uniqueVulnerableResources = vulnerableResourceNames.size;

    const securedResourcesList = allScannedResources.filter(r => !vulnerableResourceNames.has(r.name));

    let computedScore = 100;
    if (totalScanned > 0) {
      computedScore = Math.round(((totalScanned - uniqueVulnerableResources) / totalScanned) * 100);
      computedScore = Math.max(0, computedScore);
    }

    // Fetch AWS Account ID for accurate project grouping
    let awsAccountId = maskedKeyId;
    try {
      const stsClient = new STSClient({ credentials, region: credentials.region });
      const callerIdentity = await stsClient.send(new GetCallerIdentityCommand({}));
      awsAccountId = callerIdentity.Account || maskedKeyId;
    } catch (stsError) {
      console.warn("[Engine] Failed to get AWS Account ID via STS, falling back to masked key.", stsError.message);
    }

    // --- DATABASE PERSISTENCE ---
    const projectName = `AWS Account (${awsAccountId})`;

    let project = await prisma.project.findFirst({
      where: { name: projectName, userId: req.user.userId, provider: 'aws' }
    });

    if (!project) {
      project = await prisma.project.create({
        data: { name: projectName, provider: 'aws', userId: req.user.userId, credentials: JSON.stringify(credentials) }
      });
    } else {
      // Update credentials for automation
      await prisma.project.update({
        where: { id: project.id },
        data: { credentials: JSON.stringify(credentials) }
      });
    }

    const scanRecord = await prisma.scanHistory.create({
      data: {
        score: computedScore,
        scannedResources: totalScanned,
        criticalCount,
        highCount,
        mediumCount,
        findings: JSON.stringify(allFindings),
        passedResources: JSON.stringify(securedResourcesList),
        projectId: project.id
      }
    });

    const liveResults = {
      success: true,
      projectId: projectName,
      dbScanId: scanRecord.id,
      dbProjectId: scanRecord.projectId,
      provider: 'AWS',
      summary: {
        score: computedScore,
        scannedResources: totalScanned,
        vulnerableCount: uniqueVulnerableResources,
      },
      vulnerabilities: allFindings,
      passedResources: securedResourcesList
    };

    res.json(liveResults);

  } catch (error) {
    console.error("[Engine] AWS Scanner crashed:", error);
    res.status(500).json({ error: error.message || "Internal server error during AWS scan." });
  }
});

// Azure Comprehensive Scan Route — 81 Checkpoints across 14 auditors
const {
  auditAzureIam, auditAzureVm, auditAzureVnet, auditAzureMonitor,
  auditAzureSecurity, auditAzureStorage, auditAzureSql, auditAzureAks,
  auditAzureLb, auditAzureKeyVault, auditAzureFunctions, auditAzureDns,
  auditAzureSynapse, auditAzureHdinsight
} = require('./services/azureScanner');

app.post('/api/scan/azure', authenticateToken, async (req, res) => {
  console.log("--- Received COMPREHENSIVE LIVE AZURE Scan Request ---");

  try {
    let credentials = null;
    if (req.body.credentials) {
      if (typeof req.body.credentials === 'string') {
        credentials = JSON.parse(req.body.credentials);
      } else {
        credentials = req.body.credentials;
      }
    } else {
      credentials = {
        tenantId: req.body.tenantId,
        clientId: req.body.clientId,
        clientSecret: req.body.clientSecret,
        subscriptionId: req.body.subscriptionId
      };
    }

    if (!credentials.tenantId || !credentials.clientId || !credentials.clientSecret || !credentials.subscriptionId) {
      return res.status(400).json({ error: "Missing Azure credentials (tenantId, clientId, clientSecret, subscriptionId required)." });
    }

    const { tenantId, clientId, clientSecret, subscriptionId } = credentials;
    const maskedClientId = clientId.substring(0, 4) + '...';
    console.log(`[Engine] Beginning comprehensive Azure audit for Client: ${maskedClientId}`);

    // Execute auditors in sequential chunks to prevent Cloud Run OOM
    const chunk1Results = await Promise.allSettled([
      auditAzureIam(credentials),
      auditAzureVm(credentials),
      auditAzureVnet(credentials),
      auditAzureMonitor(credentials)
    ]);
    
    const chunk2Results = await Promise.allSettled([
      auditAzureSecurity(credentials),
      auditAzureStorage(credentials),
      auditAzureSql(credentials),
      auditAzureAks(credentials)
    ]);
    
    const chunk3Results = await Promise.allSettled([
      auditAzureLb(credentials),
      auditAzureKeyVault(credentials),
      auditAzureFunctions(credentials),
      auditAzureDns(credentials)
    ]);
    
    const chunk4Results = await Promise.allSettled([
      auditAzureSynapse(credentials),
      auditAzureHdinsight(credentials)
    ]);

    const results = [
      ...chunk1Results,
      ...chunk2Results,
      ...chunk3Results,
      ...chunk4Results
    ];

    let allFindings = [];
    let totalScanned = 0;
    let allScannedResources = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allFindings = allFindings.concat(result.value.findings || []);
        totalScanned += (result.value.scannedCount || 0);
        if (result.value.scannedResourceList) {
          allScannedResources = allScannedResources.concat(result.value.scannedResourceList);
        }
      } else {
        console.error(`[Engine] Azure Auditor at index ${index} failed:`, result.reason);
      }
    });

    const criticalCount = allFindings.filter(f => f.severity === 'Critical').length;
    const highCount = allFindings.filter(f => f.severity === 'High').length;
    const mediumCount = allFindings.filter(f => f.severity === 'Medium').length;

    const vulnerableResourceNames = new Set(allFindings.map(f => f.resource));
    const uniqueVulnerableResources = vulnerableResourceNames.size;

    const securedResourcesList = allScannedResources.filter(r => !vulnerableResourceNames.has(r.name));

    let computedScore = 100;
    if (totalScanned > 0) {
      computedScore = Math.round(((totalScanned - uniqueVulnerableResources) / totalScanned) * 100);
      computedScore = Math.max(0, computedScore);
    }

    // --- DATABASE PERSISTENCE ---
    const projectName = `Azure Subscription (${subscriptionId})`;

    let project = await prisma.project.findFirst({
      where: { name: projectName, userId: req.user.userId, provider: 'azure' }
    });

    if (!project) {
      project = await prisma.project.create({
        data: { name: projectName, provider: 'azure', userId: req.user.userId, credentials: JSON.stringify(credentials) }
      });
    } else {
      await prisma.project.update({
        where: { id: project.id },
        data: { credentials: JSON.stringify(credentials) }
      });
    }

    const scanRecord = await prisma.scanHistory.create({
      data: {
        score: computedScore,
        scannedResources: totalScanned,
        criticalCount,
        highCount,
        mediumCount,
        findings: JSON.stringify(allFindings),
        passedResources: JSON.stringify(securedResourcesList),
        projectId: project.id
      }
    });

    const liveResults = {
      success: true,
      projectId: projectName,
      dbScanId: scanRecord.id,
      dbProjectId: scanRecord.projectId,
      provider: 'Azure',
      summary: {
        score: computedScore,
        scannedResources: totalScanned,
        vulnerableCount: uniqueVulnerableResources,
      },
      vulnerabilities: allFindings,
      passedResources: securedResourcesList
    };

    res.json(liveResults);

  } catch (error) {
    console.error("[Engine] Azure Scanner crashed:", error);
    res.status(500).json({ error: error.message || "Internal server error during Azure scan." });
  }
});

const { startScheduler } = require('./services/scheduler');

async function startServer() {
  try {
    try {
      await prisma.$connect();
      console.log('Successfully connected to the database.');
    } catch (dbError) {
      console.error('---------------------------------------------------------');
      console.error('DATABASE CONNECTION FAILED ON STARTUP!');
      console.error('1. Did you add DATABASE_URL to Cloud Run Environment Variables?');
      console.error('2. Did you whitelist IP 0.0.0.0/0 in MongoDB Atlas Network Access?');
      console.error('Detailed Error:', dbError.message);
      console.error('---------------------------------------------------------');
      // We intentionally do NOT exit here, so Cloud Run can still successfully bind to port 8080.
    }

    // Initialize Scheduler only if explicitly enabled or in production
    // This prevents background audits from unexpectedly running when starting the local dev server.
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
      startScheduler();
    } else {
      console.log('Scheduler disabled in development mode. Set ENABLE_SCHEDULER=true to enable.');
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('CRITICAL STARTUP ERROR:', error);
    process.exit(1);
  }
}

startServer();
