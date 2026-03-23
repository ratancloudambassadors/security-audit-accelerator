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
const { auditAwsIam, auditAwsEc2, auditAwsS3 } = require('./awsScanner');
const { generateReportBuffer } = require('../routes/reports'); // Import helper if available, otherwise we will refactor
const nodemailer = require('nodemailer');

// Helper to send email
const sendAuditEmail = async (userEmail, scanData, projectName) => {
    console.log(`[Scheduler] Attempting to send email to ${userEmail} using ${process.env.SMTP_USER}`);
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('[Scheduler] ERROR: SMTP_USER or SMTP_PASS is missing in environment variables!');
        return;
    }
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Basic HTML layout for the email
        const htmlContent = `
            <h2>Automated Security Audit Report</h2>
            <p>Your scheduled audit for <strong>${projectName}</strong> has completed.</p>
            <div style="background: #f4f4f4; padding: 20px; border-radius: 8px;">
                <h3>Summary</h3>
                <ul>
                    <li><strong>Security Score:</strong> ${scanData.score}%</li>
                    <li><strong>Total Resources Scanned:</strong> ${scanData.scannedResources}</li>
                    <li><strong>Critical Findings:</strong> ${scanData.criticalCount}</li>
                    <li><strong>High Findings:</strong> ${scanData.highCount}</li>
                    <li><strong>Medium Findings:</strong> ${scanData.mediumCount}</li>
                </ul>
            </div>
            <p>Please log in to your dashboard to view the full details and remediation steps.</p>
        `;

        await transporter.sendMail({
            from: `"AuditScope Automation" <${process.env.SMTP_USER}>`,
            to: userEmail,
            subject: `[Automated] Security Audit Result: ${projectName} - ${scanData.score}%`,
            html: htmlContent
        });

        console.log(`[Scheduler] Email sent to ${userEmail} for project ${projectName}`);
    } catch (err) {
        console.error('[Scheduler] Email error:', err);
    }
};

const runGcpScan = async ({ credentials, id, userId }) => {
    try {
        const parsedCreds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
        const clients = initializeGcpClients(parsedCreds);
        const gcpProjectId = clients.projectId;

        const auditPromises = [
            auditStorageBuckets(clients.storageClient, gcpProjectId),
            auditVMs(clients.computeClient, clients.projectClient, gcpProjectId),
            auditIAM(clients.googleAuthClient, gcpProjectId),
            auditCloudSQL(clients.googleAuthClient, gcpProjectId),
            auditNetworking(clients.networksClient, clients.firewallsClient, gcpProjectId),
            auditBigQuery(clients.bigQueryClient, gcpProjectId)
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

        // Only save to history if we have a valid project ID
        if (id && id !== 'unknown') {
            const savedScan = await prisma.scanHistory.create({
                data: {
                    score: computedScore,
                    scannedResources: totalScanned,
                    criticalCount,
                    highCount,
                    mediumCount,
                    findings: JSON.stringify(allFindings),
                    projectId: id
                }
            });
            console.log(`[Scheduler] AWS Scan history saved for project ${id}. Score: ${computedScore}%`);
            return savedScan;
        }
        
        return { score: computedScore, scannedResources: totalScanned, criticalCount, highCount, mediumCount };
    } catch (err) {
        console.error(`[Scheduler] GCP scan failed for project ${id}:`, err);
        return null;
    }
};

const runAwsScan = async ({ credentials, id, userId }) => {
    try {
        const parsedCreds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
        const auditPromises = [
            auditAwsIam(parsedCreds),
            auditAwsEc2(parsedCreds),
            auditAwsS3(parsedCreds)
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

        if (id && id !== 'unknown') {
            const savedScan = await prisma.scanHistory.create({
                data: {
                    score: computedScore,
                    scannedResources: totalScanned,
                    criticalCount,
                    highCount,
                    mediumCount,
                    findings: JSON.stringify(allFindings),
                    projectId: id
                }
            });
            console.log(`[Scheduler] Scan history saved for project ${id}. Score: ${computedScore}%`);
            return savedScan;
        }
        return { score: computedScore, scannedResources: totalScanned, criticalCount, highCount, mediumCount };
    } catch (err) {
        console.error(`[Scheduler] AWS scan failed for project ${id}:`, err);
        return null;
    }
};

const startScheduler = () => {
    // Check every minute (faster for testing/dev)
    cron.schedule('* * * * *', async () => {
        console.log('[Scheduler] Checking for due audits...');
        const now = new Date();

        try {
            const dueSchedules = await prisma.auditSchedule.findMany({
                where: {
                    isActive: true,
                    nextRun: { lte: now }
                },
                include: {
                    user: true,
                    project: true
                }
            });

            console.log(`[Scheduler] Found ${dueSchedules.length} due audits.`);

            for (const schedule of dueSchedules) {
                console.log(`[Scheduler] Running audit for user ${schedule.user.email}`);

                // Priority: AuditSchedule.credentials -> Project.credentials
                const credentialsSource = schedule.credentials || (schedule.project && schedule.project.credentials);
                
                if (!credentialsSource) {
                    console.error(`[Scheduler] No credentials found for schedule ${schedule.id}`);
                    continue;
                }

                let scanResult = null;
                const provider = schedule.project ? schedule.project.provider : 'gcp'; // fallback if project is missing

                if (provider === 'gcp') {
                    scanResult = await runGcpScan({ credentials: credentialsSource, id: schedule.projectId || 'unknown' });
                } else if (provider === 'aws') {
                    scanResult = await runAwsScan({ credentials: credentialsSource, id: schedule.projectId || 'unknown' });
                }

                if (scanResult) {
                    await sendAuditEmail(schedule.user.email, scanResult, (schedule.project ? schedule.project.name : 'Automated Scan'));
                }

                // Update schedule for next run
                const computeNextRun = (freq, t, days, mDay) => {
                    const now = new Date();
                    const [hours, minutes] = t.split(':').map(Number);
                    let next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

                    // Skip the current one that just ran
                    next.setMinutes(next.getMinutes() + 1);

                    if (freq === 'daily') {
                        if (next <= now) next.setDate(next.getDate() + 1);
                    } else if (freq === 'weekly' && days && days.length > 0) {
                        const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
                        const dayIndices = days.map(d => dayMap[d]);
                        for(let i=1; i<8; i++) {
                            const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hours, minutes, 0);
                            if (dayIndices.includes(checkDate.getDay())) {
                                 return checkDate;
                            }
                        }
                    } else if (freq === 'monthly' && mDay) {
                        next = new Date(now.getFullYear(), now.getMonth(), mDay, hours, minutes, 0);
                        if (next <= now) next.setMonth(next.getMonth() + 1);
                    } else {
                        // Default +1 day if anything is weird
                        next.setDate(next.getDate() + 1);
                    }
                    return next;
                };

                const nextRun = computeNextRun(schedule.frequency, schedule.time, schedule.daysOfWeek, schedule.dayOfMonth);

                await prisma.auditSchedule.update({
                    where: { id: schedule.id },
                    data: {
                        lastRun: now,
                        nextRun: nextRun
                    }
                });
            }
        } catch (err) {
            console.error('[Scheduler] Critical error in cron job:', err);
        }
    });

    console.log('[Scheduler] Service started successfully.');
};

module.exports = { startScheduler };
