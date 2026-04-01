const express = require('express');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-local-key-for-jwt';

// Helper for Real Email Sending
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied.' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token.' });
    req.user = user;
    next();
  });
};

router.use(authenticateToken);

// Helper: generate the PDF buffer from scan data
function generatePDF(scanData, userName, projectId) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const cyan = '#06b6d4';
    const darkBg = '#0f172a';

    // --- HEADER ---
    doc.rect(0, 0, doc.page.width, 100).fill(darkBg);
    doc.fontSize(24).fillColor(cyan).text('AuditScope', 50, 30, { continued: true });
    doc.fontSize(24).fillColor('#ffffff').text(' Security Report');
    doc.fontSize(10).fillColor('#94a3b8').text(`Generated for: ${userName}  |  Project: ${projectId}  |  ${new Date().toLocaleString()}`, 50, 62);

    doc.moveDown(3);

    // --- SUMMARY BOX ---
    const score = scanData.score || 0;
    const vulnCount = scanData.vulnerabilities?.length || 0;
    const scanned = scanData.scanned || 0;

    doc.fillColor('#1e293b');
    doc.roundedRect(50, 120, doc.page.width - 100, 80, 8).fill('#1e293b');

    doc.fontSize(28).fillColor(score > 80 ? '#22c55e' : score > 50 ? '#eab308' : '#ef4444')
       .text(`${score}%`, 80, 135);
    doc.fontSize(9).fillColor('#94a3b8').text('SECURITY SCORE', 80, 168);

    doc.fontSize(28).fillColor('#ffffff').text(`${vulnCount}`, 230, 135);
    doc.fontSize(9).fillColor('#94a3b8').text('VULNERABILITIES', 230, 168);

    doc.fontSize(28).fillColor('#ffffff').text(`${scanned}`, 420, 135);
    doc.fontSize(9).fillColor('#94a3b8').text('RESOURCES SCANNED', 420, 168);

    doc.moveDown(4);

    // --- FINDINGS TABLE ---
    const vulnerabilities = scanData.vulnerabilities || [];
    if (vulnerabilities.length > 0) {
      const tableTop = 230;

      doc.fontSize(14).fillColor('#0f172a').text('Vulnerability Findings', 50, tableTop);
      doc.moveTo(50, tableTop + 20).lineTo(doc.page.width - 50, tableTop + 20).strokeColor('#cbd5e1').stroke();

      const headerY = tableTop + 28;
      doc.fontSize(8).fillColor('#475569');
      doc.text('SEVERITY', 50, headerY);
      doc.text('RESOURCE', 130, headerY);
      doc.text('ISSUE', 310, headerY);
      doc.moveTo(50, headerY + 14).lineTo(doc.page.width - 50, headerY + 14).strokeColor('#e2e8f0').stroke();

      let rowY = headerY + 22;

      for (const vuln of vulnerabilities) {
        if (rowY > doc.page.height - 80) {
          doc.addPage();
          rowY = 50;
        }

        const sevColor = vuln.severity === 'Critical' ? '#dc2626' : vuln.severity === 'High' ? '#ea580c' : vuln.severity === 'Medium' ? '#ca8a04' : '#2563eb';

        doc.fontSize(8).fillColor(sevColor).text(vuln.severity.toUpperCase(), 50, rowY, { width: 70 });
        doc.fontSize(8).fillColor('#1e293b').text(vuln.resource || '-', 130, rowY, { width: 170 });
        doc.fontSize(8).fillColor('#475569').text(vuln.issue || '-', 310, rowY, { width: 240 });

        rowY += Math.max(doc.heightOfString(vuln.issue || '-', { width: 240, fontSize: 8 }), 14) + 6;
        doc.moveTo(50, rowY - 3).lineTo(doc.page.width - 50, rowY - 3).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      }
    } else {
      doc.fontSize(14).fillColor('#16a34a').text('No vulnerabilities found. Your infrastructure looks secure!', 50, 230);
    }

    // --- FOOTER ---
    const lastPage = doc.bufferedPageRange();
    for (let i = 0; i < lastPage.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#475569')
         .text('AuditScope — Automated Cloud Security Audit Platform', 50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });
    }

    doc.end();
  });
}

// POST /api/reports/download — generates and returns the PDF directly
router.post('/download', async (req, res) => {
  try {
    const { scanData } = req.body;

    if (!scanData) {
      return res.status(400).json({ error: 'scanData is required in the request body.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const projectId = scanData.projectId || scanData.provider?.toUpperCase() || 'Cloud Project';

    const pdfBuffer = await generatePDF(scanData, user.name || user.email, projectId);

    const filename = `AuditScope_Report_${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

    console.log(`[Report] PDF downloaded by ${user.email}`);

  } catch (error) {
    console.error('[Report] Error generating report:', error);
    res.status(500).json({ error: error.message || 'Failed to generate report.' });
  }
});

// POST /api/reports/send — generates PDF and securely emails it via Nodemailer
router.post('/send', async (req, res) => {
  try {
    const { scanData, recipientEmail } = req.body;

    if (!scanData) {
      return res.status(400).json({ error: 'scanData is required in the request body.' });
    }
    if (!recipientEmail) {
      return res.status(400).json({ error: 'recipientEmail is required.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const projectId = scanData.projectId || scanData.provider?.toUpperCase() || 'Cloud Project';

    const pdfBuffer = await generatePDF(scanData, user.name || user.email, projectId);

    // Real SMTP delivery for the PDF report
    if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com') {
      console.log('--- DEVELOPMENT MODE: SMTP NOT CONFIGURED ---');
      console.log(`Simulating PDF Email to ${recipientEmail}`);
      console.log('---------------------------------------------');
      return res.json({ success: true, message: `Report emailed to ${recipientEmail} (Simulated - SMTP not configured)` });
    }

    const filename = `AuditScope_Report_${new Date().toISOString().slice(0, 10)}.pdf`;

    await transporter.sendMail({
      from: `"AuditScope Security" <${process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: `🛡️ Security Audit Report — Score: ${scanData.score}%`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
          <h2>Security Audit Report</h2>
          <p>Please find attached the security audit report for your project <b>${projectId}</b>.</p>
          <ul>
            <li><b>Score:</b> ${scanData.score}%</li>
            <li><b>Vulnerabilities Found:</b> ${scanData.vulnerabilities?.length || 0}</li>
            <li><b>Resources Scanned:</b> ${scanData.scanned || 0}</li>
          </ul>
          <p>Thank you for using AuditScope.</p>
        </div>
      `,
      attachments: [
        {
          filename: filename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    console.log(`[Report] PDF report emailed successfully to ${recipientEmail}`);
    res.json({ success: true, message: `Report emailed successfully to ${recipientEmail}` });

  } catch (error) {
    console.error('[Report] Error emailing report:', error);
    res.status(500).json({ error: error.message || 'Failed to email report due to internal or SMTP error.' });
  }
});

router.generatePDF = generatePDF;
module.exports = router;
