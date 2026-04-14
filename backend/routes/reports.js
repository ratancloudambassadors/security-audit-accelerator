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

const getServiceName = (resource) => {
  if (!resource) return 'Other';
  const match = resource.match(/^([^(]+)/);
  let sName = match ? match[1].trim() : 'Other';
  const lowerName = sName.toLowerCase();
  
  if (lowerName.includes('compute')) return 'Compute Engine';
  if (lowerName.includes('iam')) return 'IAM';
  if (lowerName.includes('storage') || lowerName.includes('bucket')) return 'Storage';
  if (lowerName.includes('sql') || lowerName.includes('database')) return 'Database';
  if (lowerName.includes('network') || lowerName.includes('vpc') || lowerName.includes('firewall') || lowerName.includes('router') || lowerName.includes('route')) return 'Network';
  if (lowerName.includes('kubernetes') || lowerName.includes('gke') || lowerName.includes('eks')) return 'Kubernetes';
  if (lowerName.includes('kms') || lowerName.includes('key')) return 'KMS';
  if (lowerName.includes('func') || lowerName.includes('lambda')) return 'Functions';
  
  return sName;
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

    // --- FINDINGS TABLES BY SERVICE ---
    const vulnerabilities = scanData.vulnerabilities || [];
    if (vulnerabilities.length > 0) {
      let currentY = 230;

      // Group by Service
      const groups = {};
      vulnerabilities.forEach(v => {
        const sName = getServiceName(v.resource);
        if (!groups[sName]) groups[sName] = [];
        groups[sName].push(v);
      });

      const groupedServices = Object.keys(groups).sort().map(sName => ({
        name: sName,
        items: groups[sName]
      }));

      for (const serviceGroup of groupedServices) {
        if (currentY > doc.page.height - 120) {
          doc.addPage();
          currentY = 50;
        }

        // Service Header
        doc.fontSize(14).fillColor('#0f172a').text(`Service: ${serviceGroup.name}`, 50, currentY);
        doc.fontSize(10).fillColor('#64748b').text(`(${serviceGroup.items.length} items)`, 50 + doc.widthOfString(`Service: ${serviceGroup.name}`) + 10, currentY + 3);
        
        doc.moveTo(50, currentY + 20).lineTo(doc.page.width - 50, currentY + 20).strokeColor('#cbd5e1').stroke();

        const headerY = currentY + 28;
        doc.fontSize(8).fillColor('#475569');
        doc.text('SEVERITY', 50, headerY);
        doc.text('RESOURCE', 130, headerY);
        doc.text('ISSUE', 310, headerY);
        doc.moveTo(50, headerY + 14).lineTo(doc.page.width - 50, headerY + 14).strokeColor('#e2e8f0').stroke();

        let rowY = headerY + 22;

        for (const vuln of serviceGroup.items) {
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
        
        currentY = rowY + 20; // Add space before next service table
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
    const { scanData, selectedServices } = req.body;

    if (!scanData) {
      return res.status(400).json({ error: 'scanData is required in the request body.' });
    }

    if (selectedServices && !selectedServices.includes('ALL')) {
      scanData.vulnerabilities = scanData.vulnerabilities.filter(v => 
        selectedServices.includes(getServiceName(v.resource))
      );
      scanData.score = scanData.score; // Or recalculate score if necessary
      scanData.scanned = new Set(scanData.vulnerabilities.map(v => v.resource)).size;
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
    const { scanData, recipientEmail, selectedServices } = req.body;

    if (!scanData) {
      return res.status(400).json({ error: 'scanData is required in the request body.' });
    }
    if (!recipientEmail) {
      return res.status(400).json({ error: 'recipientEmail is required.' });
    }

    if (selectedServices && !selectedServices.includes('ALL')) {
      scanData.vulnerabilities = scanData.vulnerabilities.filter(v => 
        selectedServices.includes(getServiceName(v.resource))
      );
      scanData.scanned = new Set(scanData.vulnerabilities.map(v => v.resource)).size;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const projectId = scanData.projectId || scanData.provider?.toUpperCase() || 'Cloud Project';

    const pdfBuffer = await generatePDF(scanData, user.name || user.email, projectId);

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
      subject: `Confidential Security Audit Report — ${projectId}`,
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 8px; color: #334155;">
          <h2 style="color: #0f172a; border-bottom: 2px solid #06b6d4; padding-bottom: 10px; margin-bottom: 20px;">Confidential Security Audit Report</h2>
          <p style="font-size: 16px; line-height: 1.6;">Dear Stakeholder,</p>
          <p style="font-size: 16px; line-height: 1.6;">Please find the attached comprehensive security audit report detailing the vulnerability posture and infrastructure analysis for the project: <strong style="color: #0f172a;">${projectId}</strong>.</p>
          <p style="font-size: 16px; line-height: 1.6;">This automated assessment evaluates identity management, network configurations, compute environments, and storage isolation against established cloud benchmarking standards.</p>
          
          <table style="width: 100%; margin: 25px 0; border-collapse: collapse;">
            <tbody>
              <tr>
                <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; width: 40%; background-color: #f8fafc;">Aggregate Safety Score</td>
                <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: ${scanData.score > 80 ? '#16a34a' : scanData.score > 50 ? '#ca8a04' : '#dc2626'};">${scanData.score}%</td>
              </tr>
              <tr>
                <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Total Vulnerabilities Identified</td>
                <td style="padding: 12px; border: 1px solid #e2e8f0;">${scanData.vulnerabilities?.length || 0}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Total Infrastructure Entities Scanned</td>
                <td style="padding: 12px; border: 1px solid #e2e8f0;">${scanData.scanned || 0}</td>
              </tr>
            </tbody>
          </table>

          <p style="font-size: 14px; line-height: 1.6; color: #64748b;">It is highly recommended that your engineering and security teams review the attached PDF payload for precise remediation directives.</p>
          <p style="font-size: 14px; line-height: 1.6; color: #64748b; margin-top: 30px;">Regards,<br><strong style="color: #0f172a;">AuditScope Automated Systems</strong><br><em>Do not reply to this automated message.</em></p>
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
