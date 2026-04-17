require('dotenv').config();
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { initializeGcpClients } = require('./gcp/auth');
const { auditStorageBuckets } = require('./gcp/auditors/storageAuditor');
const { auditVMs } = require('./gcp/auditors/vmAuditor');
const { auditIAM } = require('./gcp/auditors/iamAuditor');
const { auditCloudSQL } = require('./gcp/auditors/sqlAuditor');
const { auditNetworking } = require('./gcp/auditors/networkingAuditor');
const { auditBigQuery } = require('./gcp/auditors/bigqueryAuditor');
const { auditKMS } = require('./gcp/auditors/kmsAuditor');
const { auditApiKeys } = require('./gcp/auditors/apiKeysAuditor');
const { auditEssentialContacts } = require('./gcp/auditors/essentialContactsAuditor');
const { auditDns } = require('./gcp/auditors/dnsAuditor');
const { auditLogging } = require('./gcp/auditors/loggingAuditor');
const { auditDataproc } = require('./gcp/auditors/dataprocAuditor');
const { auditGKE } = require('./gcp/auditors/gkeAuditor');
const { auditLoadBalancers } = require('./gcp/auditors/lbAuditor');
const { auditServerless } = require('./gcp/auditors/serverlessAuditor');
const { auditNetworkingDepth } = require('./gcp/auditors/networkingDepthAuditor');
const { auditAwsIam, auditAwsEc2, auditAwsS3, auditAwsRds, auditAwsEks, auditAwsLb, auditAwsServerless } = require('./awsScanner');
const { generatePDF } = require('../routes/reports');
const { generateExcelReport } = require('./excelGenerator');
const nodemailer = require('nodemailer');

// Use structured transporter matching reports.js for higher reliability
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Helper to send email with PDF attachment
const sendAuditEmail = async (userEmail, scanData, projectName) => {
    console.log(`[Scheduler] ✉️  Attempting to send report to ${userEmail}...`);
    
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('[Scheduler] ERROR: SMTP_USER or SMTP_PASS is missing!');
        return;
    }

    try {
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">🔒 Automated Security Audit</h1>
                    <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0;">AuditScope — Scheduled Report</p>
                </div>
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                    <p style="color: #495057;">Your scheduled audit for <strong>${projectName}</strong> has completed successfully.</p>
                    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6; margin: 20px 0;">
                        <h3 style="margin: 0 0 16px 0; color: #212529;">📊 Audit Summary</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr style="background: #f8f9fa;">
                                <td style="padding: 10px; font-weight: 600; color: #495057;">Security Score</td>
                                <td style="padding: 10px; font-size: 18px; font-weight: 700; color: ${scanData.score >= 80 ? '#22c55e' : scanData.score >= 60 ? '#f59e0b' : '#ef4444'}">
                                    ${scanData.score}%
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; font-weight: 600; color: #495057;">Resources Scanned</td>
                                <td style="padding: 10px;">${scanData.scannedResources}</td>
                            </tr>
                            <tr style="background: #f8f9fa;">
                                <td style="padding: 10px; font-weight: 600; color: #dc3545;">Critical Findings</td>
                                <td style="padding: 10px; color: #dc3545; font-weight: 700;">${scanData.criticalCount}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; font-weight: 600; color: #fd7e14;">High Findings</td>
                                <td style="padding: 10px; color: #fd7e14; font-weight: 700;">${scanData.highCount}</td>
                            </tr>
                            <tr style="background: #f8f9fa;">
                                <td style="padding: 10px; font-weight: 600; color: #ffc107;">Medium Findings</td>
                                <td style="padding: 10px; color: #ffc107; font-weight: 700;">${scanData.mediumCount}</td>
                            </tr>
                        </table>
                    </div>
                    <p style="color: #6c757d; font-size: 14px;">
                        The full PDF audit report is attached to this email. Log in to your AuditScope dashboard for detailed remediation steps.
                    </p>
                    <p style="color: #adb5bd; font-size: 12px; margin-top: 20px;">
                        This is an automated report generated by AuditScope at ${new Date().toLocaleString()}
                    </p>
                </div>
            </div>
        `;

        let pdfBuffer = Buffer.from('');
        try {
            const pdfScanData = {
                score: scanData.score,
                vulnerabilities: typeof scanData.findings === 'string' ? JSON.parse(scanData.findings) : (scanData.findings || scanData.vulnerabilities || []),
                scanned: scanData.scannedResources || scanData.scanned || 0
            };
            pdfBuffer = await generatePDF(pdfScanData, userEmail, projectName);
        } catch (e) {
            console.error('[Scheduler] Failed to generate PDF for automation:', e);
        }

        let excelBuffer = Buffer.from('');
        try {
            excelBuffer = await generateExcelReport(scanData, projectName);
        } catch (e) {
            console.error('[Scheduler] Failed to generate Excel for automation:', e);
        }

        const filename = `AuditScope_Report_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
        const excelFilename = filename.replace('.pdf', '.xlsx');

        await transporter.sendMail({
            from: `"AuditScope Automation" <${process.env.SMTP_USER}>`,
            to: userEmail,
            subject: `[Automated] Security Audit: ${projectName} — Score ${scanData.score}%`,
            html: htmlContent,
            attachments: [
                ...(pdfBuffer.length > 0 ? [{
                    filename: filename,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }] : []),
                ...(excelBuffer.length > 0 ? [{
                    filename: excelFilename,
                    content: excelBuffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }] : [])
            ]
        });

        console.log(`[Scheduler] ✉️  Email sent to ${userEmail} for project "${projectName}"`);
    } catch (err) {
        console.error('[Scheduler] Email error:', err);
    }
};

/**
 * Ensure a project record exists for this schedule.
 * Returns the project ID that should be used for saving the scan.
 */
const ensureProjectLinked = async (schedule, credentialsSource) => {
    // If the schedule already has a projectId, use it
    if (schedule.projectId) return schedule.projectId;

    // Otherwise create a new Project record so the scan can be stored
    console.log(`[Scheduler] No projectId on schedule ${schedule.id}, creating a project record...`);
    try {
        let projectName = 'Automated Scan';
        const provider = schedule.project?.provider || 'gcp';

        if (provider === 'gcp' && credentialsSource) {
            try {
                const parsed = typeof credentialsSource === 'string' ? JSON.parse(credentialsSource) : credentialsSource;
                if (parsed.project_id) projectName = parsed.project_id;
            } catch (e) {}
        } else if (provider === 'aws' && credentialsSource) {
            try {
                const parsed = typeof credentialsSource === 'string' ? JSON.parse(credentialsSource) : credentialsSource;
                if (parsed.accessKeyId) projectName = `AWS Project (${parsed.accessKeyId.substring(0, 6)}...)`;
            } catch (e) {}
        }

        const newProject = await prisma.project.create({
            data: {
                name: projectName,
                provider: provider,
                credentials: typeof credentialsSource === 'string' ? credentialsSource : JSON.stringify(credentialsSource),
                userId: schedule.userId
            }
        });

        // Link the schedule to this new project for future runs
        await prisma.auditSchedule.update({
            where: { id: schedule.id },
            data: { projectId: newProject.id }
        });

        console.log(`[Scheduler] Created & linked project "${projectName}" (${newProject.id}) to schedule ${schedule.id}`);
        return newProject.id;
    } catch (err) {
        console.error('[Scheduler] Failed to create project record:', err);
        return null;
    }
};

const runGcpScan = async ({ credentials, projectId }) => {
    try {
        const parsedCreds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
        const clients = initializeGcpClients(parsedCreds);
        const gcpProjectId = clients.projectId;

        const auditPromises = [
            auditStorageBuckets(clients.storageClient, gcpProjectId),
            auditVMs(clients.computeClient, clients.projectClient, gcpProjectId),
            auditIAM(clients.googleAuthClient, gcpProjectId),
            auditCloudSQL(clients.googleAuthClient, gcpProjectId),
            auditNetworking(clients.networksClient, clients.firewallsClient, clients.subnetworksClient, clients.backendServicesClient, gcpProjectId),
            auditBigQuery(clients.bigQueryClient, gcpProjectId),
            auditKMS(clients.googleAuthClient, gcpProjectId),
            auditApiKeys(clients.googleAuthClient, gcpProjectId),
            auditEssentialContacts(clients.googleAuthClient, gcpProjectId),
            auditDns(clients.googleAuthClient, gcpProjectId),
            auditLogging(clients.googleAuthClient, gcpProjectId),
            auditDataproc(clients.googleAuthClient, gcpProjectId),
            auditGKE(clients.googleAuthClient, gcpProjectId),
            auditLoadBalancers(clients.googleAuthClient, gcpProjectId),
            auditServerless(clients.googleAuthClient, gcpProjectId),
            auditNetworkingDepth(clients.googleAuthClient, gcpProjectId)
        ];

        const results = await Promise.allSettled(auditPromises);
        let allFindings = [];
        let totalScanned = 0;
        let skippedChecks = [];
        // Precise mapping of the 77 internal security rules across all GCP modules
        const auditorMeta = [
          { name: 'Storage',            checks: 4 },
          { name: 'VMs',                checks: 10 },
          { name: 'IAM',                checks: 8 },
          { name: 'SQL',                checks: 6 },
          { name: 'Networking',         checks: 8 },
          { name: 'BigQuery',           checks: 3 },
          { name: 'KMS',                checks: 3 },
          { name: 'API Keys',           checks: 2 },
          { name: 'Essential Contacts', checks: 1 },
          { name: 'DNS',                checks: 2 },
          { name: 'Logging',            checks: 12 },
          { name: 'Dataproc',           checks: 2 },
          { name: 'Kubernetes (GKE)',   checks: 6 },
          { name: 'Load Balancers',     checks: 4 },
          { name: 'Serverless',         checks: 3 },
          { name: 'Deep Networking',    checks: 1 }
        ];

        let totalCheckpoints = 0;
        let skippedCheckpoints = 0;

        results.forEach((result, idx) => {
            const meta = auditorMeta[idx];
            
            if (result.status === 'fulfilled') {
                allFindings = allFindings.concat(result.value.findings || []);
                const resourceCount = result.value.scannedCount || 0;
                totalScanned += resourceCount;
                
                // Scale checkpoints by number of resources found (Atomic Validations)
                // If 0 resources, the service check itself counts as 1 validation of 'existence'
                const serviceValidations = Math.max(1, resourceCount * meta.checks);
                totalCheckpoints += serviceValidations;

                if (result.value.skipped || result.value.error) {
                    skippedCheckpoints += serviceValidations;
                    skippedChecks.push({
                        service: meta.name,
                        reason: result.value.reason || result.value.error || 'Service API not enabled'
                    });
                }
            } else {
                // If it failed completely, count it as the baseline service check failing
                totalCheckpoints += meta.checks;
                skippedCheckpoints += meta.checks;
                skippedChecks.push({
                    service: meta.name,
                    reason: result.reason?.message || 'Unexpected auditor failure'
                });
            }
        });

        const totalChecks = totalCheckpoints;
        const criticalCount = allFindings.filter(f => f.severity === 'Critical').length;
        const highCount = allFindings.filter(f => f.severity === 'High').length;
        const mediumCount = allFindings.filter(f => f.severity === 'Medium').length;
        const uniqueVulnerableResources = new Set(allFindings.map(f => f.resource)).size;

        let computedScore = 100;
        if (totalScanned > 0) {
            computedScore = Math.round(((totalScanned - uniqueVulnerableResources) / totalScanned) * 100);
            computedScore = Math.max(0, computedScore);
        }

        // Always save to history — we now always have a valid projectId
        if (projectId) {
            const savedScan = await prisma.scanHistory.create({
                data: {
                    score: computedScore,
                    scannedResources: totalScanned,
                    totalChecks: totalChecks,
                    skippedChecks: JSON.stringify(skippedChecks),
                    criticalCount,
                    highCount,
                    mediumCount,
                    findings: JSON.stringify(allFindings),
                    projectId: projectId
                }
            });
            console.log(`[Scheduler] ✅ GCP scan saved. Score: ${computedScore}%, Checks: ${totalChecks - skippedChecks.length}/${totalChecks}`);
            return savedScan;
        }

        return { 
            score: computedScore, 
            scannedResources: totalScanned, 
            totalChecks, 
            skippedChecks: JSON.stringify(skippedChecks),
            criticalCount, 
            highCount, 
            mediumCount, 
            findings: JSON.stringify(allFindings) 
        };
    } catch (err) {
        console.error(`[Scheduler] GCP scan failed for project ${projectId}:`, err.message);
        return null;
    }
};

const runAwsScan = async ({ credentials, projectId }) => {
    try {
        const parsedCreds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
        const auditPromises = [
            auditAwsIam(parsedCreds),
            auditAwsEc2(parsedCreds),
            auditAwsS3(parsedCreds),
            auditAwsRds(parsedCreds),
            auditAwsEks(parsedCreds),
            auditAwsLb(parsedCreds),
            auditAwsServerless(parsedCreds)
        ];

        const results = await Promise.allSettled(auditPromises);
        let allFindings = [];
        let totalScanned = 0;

        results.forEach((result) => {
            if (result.status === 'fulfilled') {
                allFindings = allFindings.concat(result.value.findings || []);
                totalScanned += (result.value.scannedCount || 0);
            }
        });

        const criticalCount = allFindings.filter(f => f.severity === 'Critical').length;
        const highCount = allFindings.filter(f => f.severity === 'High').length;
        const mediumCount = allFindings.filter(f => f.severity === 'Medium').length;
        const uniqueVulnerableResources = new Set(allFindings.map(f => f.resource)).size;

        let computedScore = 100;
        if (totalScanned > 0) {
            computedScore = Math.round(((totalScanned - uniqueVulnerableResources) / totalScanned) * 100);
            computedScore = Math.max(0, computedScore);
        }

        // Always save to history — we now always have a valid projectId
        if (projectId) {
            const savedScan = await prisma.scanHistory.create({
                data: {
                    score: computedScore,
                    scannedResources: totalScanned,
                    criticalCount,
                    highCount,
                    mediumCount,
                    findings: JSON.stringify(allFindings),
                    projectId: projectId
                }
            });
            console.log(`[Scheduler] ✅ AWS scan saved for project ${projectId}. Score: ${computedScore}%`);
            return savedScan;
        }

        return { score: computedScore, scannedResources: totalScanned, criticalCount, highCount, mediumCount, findings: JSON.stringify(allFindings) };
    } catch (err) {
        console.error(`[Scheduler] AWS scan failed for project ${projectId}:`, err.message);
        return null;
    }
};

/**
 * Compute the next scheduled run time based on frequency settings.
 * All times are stored internally as UTC in the DB.
 */
const computeNextRun = (freq, t, days, mDay) => {
    const now = new Date();
    const [hours, minutes] = t.split(':').map(Number);

    // Build next run candidate: today at the specified UTC time
    let next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes, 0));

    if (freq === 'daily') {
        // If time has already passed today, schedule for tomorrow
        if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    } else if (freq === 'weekly' && days && days.length > 0) {
        const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
        const dayIndices = days.map(d => dayMap[d]);
        // Find the next matching weekday (search up to 7 days ahead)
        let found = false;
        for (let i = 1; i <= 7; i++) {
            const checkDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i, hours, minutes, 0));
            if (dayIndices.includes(checkDate.getUTCDay())) {
                next = checkDate;
                found = true;
                break;
            }
        }
        if (!found) next.setUTCDate(next.getUTCDate() + 7); // safety fallback
    } else if (freq === 'monthly' && mDay) {
        next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), mDay, hours, minutes, 0));
        if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1);
    } else {
        // Default: next day
        if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    }

    return next;
};

let isProcessing = false;

const startScheduler = () => {
    console.log('[Scheduler] ⏰ Starting scheduler service — checking for due audits...');

    // Check every minute
    cron.schedule('* * * * *', async () => {
        if (isProcessing) {
            console.log('[Scheduler] Tick skipped: Previous audit loop still running.');
            return;
        }

        const now = new Date();
        isProcessing = true;

        try {
            const dueSchedules = await prisma.auditSchedule.findMany({
                where: {
                    isActive: true,
                    nextRun: { lte: now }
                }
                // include removed to prevent whole-set crash due to orphan relations
            });

            if (dueSchedules.length === 0) {
                isProcessing = false;
                return;
            }

            console.log(`[Scheduler] 🚀 Found ${dueSchedules.length} due audit(s).`);

            for (const schedule of dueSchedules) {
                try {
                    // Fetch related data individually to isolate orphan errors
                    const user = await prisma.user.findUnique({ where: { id: schedule.userId } });
                    const project = schedule.projectId ? await prisma.project.findUnique({ where: { id: schedule.projectId } }) : null;

                    if (!user) {
                        console.warn(`[Scheduler] ⚠️ Skipping schedule ${schedule.id}: User ${schedule.userId} not found.`);
                        continue;
                    }

                    console.log(`[Scheduler] ─── Running audit for schedule: ${schedule.id}`);

                    // Update nextRun to far future IMMEDIATELY to prevent double-triggering
                    // if this scan takes longer than 60 seconds (next tick).
                    await prisma.auditSchedule.update({
                        where: { id: schedule.id },
                        data: { nextRun: new Date(now.getTime() + 1000 * 60 * 60 * 24) } // +1 day safety bump
                    });

                    const credentialsSource = schedule.credentials || (project && project.credentials);

                    if (!credentialsSource) {
                        console.error(`[Scheduler] ❌ No credentials found for ${schedule.id}`);
                        continue;
                    }

                    const resolvedProjectId = await ensureProjectLinked(schedule, credentialsSource);
                    if (!resolvedProjectId) continue;

                    const provider = project ? project.provider : 'gcp';
                    let scanResult = null;

                    if (provider === 'gcp') {
                        scanResult = await runGcpScan({ credentials: credentialsSource, projectId: resolvedProjectId });
                    } else if (provider === 'aws') {
                        scanResult = await runAwsScan({ credentials: credentialsSource, projectId: resolvedProjectId });
                    }

                    if (scanResult) {
                        const emailToUse = schedule.targetEmail || user.email;
                        const projectName = project ? project.name : 'Automated Scan';
                        await sendAuditEmail(emailToUse, scanResult, projectName);
                    }

                    // Compute and persist the ACTUAL next run time
                    const nextRun = computeNextRun(schedule.frequency, schedule.time, schedule.daysOfWeek, schedule.dayOfMonth);
                    await prisma.auditSchedule.update({
                        where: { id: schedule.id },
                        data: {
                            lastRun: now,
                            nextRun: nextRun
                        }
                    });

                    console.log(`[Scheduler] ✅ Finished schedule ${schedule.id}. Next: ${nextRun.toISOString()}`);
                } catch (err) {
                    console.error(`[Scheduler] Failed processing schedule ${schedule.id}:`, err);
                }
            }
        } catch (err) {
            console.error('[Scheduler] ❌ Critical loop error:', err);
        } finally {
            isProcessing = false;
        }
    });

    console.log('[Scheduler] ✅ Scheduler service started successfully.');
};

module.exports = { startScheduler };
