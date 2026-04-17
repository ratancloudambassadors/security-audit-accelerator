const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer');
const { generatePDF } = require('./routes/reports');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER || "crtproject258@gmail.com",
        pass: process.env.SMTP_PASS || "lxiz muyd zast abwg",
    },
});

async function forceRunSchedules() {
    console.log("Fetching active schedules...");
    const schedules = await prisma.auditSchedule.findMany({
        where: { isActive: true },
        take: 3,
        orderBy: { createdAt: 'desc' }
    });

    if (schedules.length === 0) {
        console.log("No active schedules found.");
        return;
    }

    console.log(`Found ${schedules.length} active schedules. Triggering email for the first one...`);
    const schedule = schedules[0];
    
    console.log("Schedule targetEmail: ", schedule.targetEmail);
    console.log("Schedule properties: ", { id: schedule.id, nextRun: schedule.nextRun });

    // Mock scan data
    const pdfScanData = {
        score: 85,
        vulnerabilities: [],
        scanned: 100
    };

    try {
        console.log("Generating PDF...");
        const pdfBuffer = await generatePDF(pdfScanData, schedule.targetEmail, "Automated Scan");

        console.log(`Sending email to ${schedule.targetEmail}...`);
        const info = await transporter.sendMail({
            from: `"AuditScope Force Run" <crtproject258@gmail.com>`,
            to: schedule.targetEmail,
            subject: `[Forced] Audit Report`,
            text: "This is a forced test of the automated email.",
            attachments: [{
                filename: 'Test_Report.pdf',
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        });

        console.log("Success! Email sent. Response: ", info.response);
    } catch (e) {
        console.error("Failed to send email: ", e);
    }
}

forceRunSchedules().catch(console.error).finally(() => prisma.$disconnect());
