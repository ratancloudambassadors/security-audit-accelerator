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

    const indigo  = '#4f46e5';
    const darkBg  = '#0f172a';
    const slate50 = '#f8fafc';
    const slate200= '#e2e8f0';
    const slate600= '#475569';
    const slate800= '#1e293b';

    // ── HEADER ────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 110).fill(darkBg);
    doc.fontSize(22).fillColor('#ffffff').text('AuditScope', 50, 28, { continued: true });
    doc.fontSize(22).fillColor(indigo).text(' Security Report');
    doc.fontSize(9).fillColor('#94a3b8')
       .text(`Project: ${projectId}   |   Prepared for: ${userName}   |   ${new Date().toLocaleString()}`, 50, 58);

    // Provider badge
    const prov = (scanData.provider || 'gcp').toUpperCase();
    doc.roundedRect(50, 76, 60, 18, 4).fill('rgba(99,102,241,0.25)');
    doc.fontSize(8).fillColor('#a5b4fc').text(prov, 56, 81);

    doc.moveDown(1);

    // ── PROJECT OVERVIEW SECTION (when called from ProjectDetailsPage) ──
    const ps = scanData.projectSummary;
    let currentY = 130;

    if (ps) {
      // Section title
      doc.fontSize(12).fillColor(slate800).text('Project Overview', 50, currentY, { underline: false });
      doc.moveTo(50, currentY + 16).lineTo(doc.page.width - 50, currentY + 16).strokeColor(slate200).lineWidth(1).stroke();
      currentY += 26;

      // Stat boxes – 4 across
      const boxW = (doc.page.width - 100 - 30) / 4;
      const boxes = [
        { label: 'TOTAL SCANS',     value: String(ps.totalScans),                     color: indigo    },
        { label: 'TOTAL RESOURCES', value: ps.totalResources.toLocaleString(),         color: '#10b981' },
        { label: 'TOTAL ISSUES',    value: ps.totalIssues.toLocaleString(),            color: ps.totalIssues > 0 ? '#ef4444' : '#22c55e' },
        { label: 'LATEST SCORE',    value: `${ps.latestScore ?? '—'}%`,               color: ps.latestScore > 80 ? '#22c55e' : ps.latestScore > 50 ? '#eab308' : '#ef4444' },
      ];
      boxes.forEach((b, i) => {
        const bx = 50 + i * (boxW + 10);
        doc.roundedRect(bx, currentY, boxW, 52, 6).fill(slate50);
        doc.moveTo(bx, currentY).lineTo(bx + boxW, currentY).strokeColor(b.color).lineWidth(2.5).stroke();
        doc.fontSize(18).fillColor(b.color).text(b.value, bx + 8, currentY + 12, { width: boxW - 16 });
        doc.fontSize(7).fillColor(slate600).text(b.label, bx + 8, currentY + 36, { width: boxW - 16 });
      });
      currentY += 62;

      // Severity summary row
      const sevItems = [
        { label: 'Critical', value: ps.totalCritical, color: '#dc2626' },
        { label: 'High',     value: ps.totalHigh,     color: '#ea580c' },
        { label: 'Medium',   value: ps.totalMedium,   color: '#ca8a04' },
      ];
      doc.roundedRect(50, currentY, doc.page.width - 100, 40, 6).fill(slate50);
      doc.fontSize(8).fillColor(slate600).text('Severity Breakdown (cumulative across all scans):', 62, currentY + 8);
      let sx = 62;
      sevItems.forEach(sv => {
        const label = `${sv.label}: ${sv.value.toLocaleString()}`;
        doc.fontSize(10).fillColor(sv.color).text(label, sx, currentY + 22);
        sx += doc.widthOfString(label) + 40;
      });
      currentY += 52;

      // Mini bar chart drawn with PDFKit primitives
      const chartTitle = `Vulnerability Breakdown`;
      doc.fontSize(10).fillColor(slate800).text(chartTitle, 50, currentY);
      currentY += 18;

      const chartH = 80;
      const chartW = doc.page.width - 100;
      const maxV   = Math.max(ps.totalCritical, ps.totalHigh, ps.totalMedium, 1);
      const bars   = [
        { label: 'Critical', value: ps.totalCritical, color: '#dc2626' },
        { label: 'High',     value: ps.totalHigh,     color: '#ea580c' },
        { label: 'Medium',   value: ps.totalMedium,   color: '#ca8a04' },
      ];
      const barW   = 40;
      const gap    = (chartW - bars.length * barW) / (bars.length + 1);

      // Axis
      doc.moveTo(50, currentY).lineTo(50, currentY + chartH).strokeColor(slate200).lineWidth(1).stroke();
      doc.moveTo(50, currentY + chartH).lineTo(50 + chartW, currentY + chartH).strokeColor(slate200).lineWidth(1).stroke();

      bars.forEach((b, i) => {
        const bx = 50 + gap + i * (barW + gap);
        const bh = maxV > 0 ? (b.value / maxV) * (chartH - 10) : 0;
        const by = currentY + chartH - bh;

        doc.roundedRect(bx, by, barW, bh, 3).fill(b.color);
        doc.fontSize(8).fillColor(b.color).text(b.value.toLocaleString(), bx + barW / 2 - 10, by - 12, { width: barW + 20, align: 'center' });
        doc.fontSize(7).fillColor(slate600).text(b.label, bx + barW / 2 - 12, currentY + chartH + 4, { width: barW + 24, align: 'center' });
      });

      currentY += chartH + 28;

      // Divider before vulnerability findings
      doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).strokeColor(slate200).lineWidth(1).stroke();
      currentY += 16;
    } else {
      // ── SUMMARY BOX (fallback – Dashboard report style) ─────────────────
      const score     = scanData.score || 0;
      const vulnCount = scanData.vulnerabilities?.length || 0;
      const scanned   = scanData.scanned || 0;

      doc.roundedRect(50, currentY, doc.page.width - 100, 80, 8).fill(slate800);
      doc.fontSize(26).fillColor(score > 80 ? '#22c55e' : score > 50 ? '#eab308' : '#ef4444')
         .text(`${score}%`, 80, currentY + 15);
      doc.fontSize(8).fillColor('#94a3b8').text('SECURITY SCORE', 80, currentY + 50);

      doc.fontSize(26).fillColor('#ffffff').text(`${vulnCount}`, 230, currentY + 15);
      doc.fontSize(8).fillColor('#94a3b8').text('VULNERABILITIES', 230, currentY + 50);

      doc.fontSize(26).fillColor('#ffffff').text(`${scanned}`, 420, currentY + 15);
      doc.fontSize(8).fillColor('#94a3b8').text('RESOURCES SCANNED', 420, currentY + 50);

      currentY += 96;
    }

    // ── FINDINGS TABLES BY SERVICE ────────────────────────────────────────
    const vulnerabilities = scanData.vulnerabilities || [];
    if (vulnerabilities.length > 0) {
      if (currentY > doc.page.height - 140) { doc.addPage(); currentY = 50; }

      doc.fontSize(12).fillColor(slate800).text(`Vulnerability Findings (${vulnerabilities.length})`, 50, currentY);
      doc.moveTo(50, currentY + 16).lineTo(doc.page.width - 50, currentY + 16).strokeColor(slate200).lineWidth(1).stroke();
      currentY += 26;

      // Group by Service
      const groups = {};
      vulnerabilities.forEach(v => {
        const sName = getServiceName(v.resource);
        if (!groups[sName]) groups[sName] = [];
        groups[sName].push(v);
      });

      const groupedServices = Object.keys(groups).sort().map(sName => ({ name: sName, items: groups[sName] }));

      for (const serviceGroup of groupedServices) {
        if (currentY > doc.page.height - 120) { doc.addPage(); currentY = 50; }

        // Service header
        doc.roundedRect(50, currentY, doc.page.width - 100, 22, 4).fill('#f1f5f9');
        doc.fontSize(9).fillColor(indigo).text(`SERVICE: ${serviceGroup.name.toUpperCase()}`, 58, currentY + 7, { continued: true });
        doc.fillColor(slate600).text(`  (${serviceGroup.items.length} item${serviceGroup.items.length !== 1 ? 's' : ''})`);
        currentY += 28;

        // Column headers
        doc.fontSize(7).fillColor(slate600);
        doc.text('SEVERITY', 50,  currentY);
        doc.text('RESOURCE', 130, currentY);
        doc.text('ISSUE',    310, currentY);
        doc.moveTo(50, currentY + 12).lineTo(doc.page.width - 50, currentY + 12).strokeColor(slate200).lineWidth(0.5).stroke();
        currentY += 18;

        for (const vuln of serviceGroup.items) {
          if (currentY > doc.page.height - 80) { doc.addPage(); currentY = 50; }

          const sevColor = vuln.severity === 'Critical' ? '#dc2626'
                         : vuln.severity === 'High'     ? '#ea580c'
                         : vuln.severity === 'Medium'   ? '#ca8a04' : '#2563eb';

          const issueH = Math.max(doc.heightOfString(vuln.issue || '-', { width: 240, fontSize: 8 }), 12);

          doc.fontSize(8).fillColor(sevColor).text(vuln.severity?.toUpperCase() || '-', 50,  currentY, { width: 70 });
          doc.fontSize(8).fillColor(slate800) .text(vuln.resource || '-',               130, currentY, { width: 170 });
          doc.fontSize(8).fillColor(slate600) .text(vuln.issue    || '-',               310, currentY, { width: 240 });

          currentY += issueH + 8;
          doc.moveTo(50, currentY - 3).lineTo(doc.page.width - 50, currentY - 3).strokeColor(slate200).lineWidth(0.4).stroke();
        }

        currentY += 14;
      }
    } else {
      if (currentY > doc.page.height - 60) { doc.addPage(); currentY = 50; }
      doc.fontSize(13).fillColor('#16a34a').text('No vulnerabilities found. Your infrastructure looks secure! ✓', 50, currentY);
    }

    // ── FOOTER (all pages) ─────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor('#94a3b8')
         .text(
           `AuditScope — Automated Cloud Security Platform  |  Page ${i + 1} of ${range.count}  |  Confidential`,
           50, doc.page.height - 38,
           { align: 'center', width: doc.page.width - 100 }
         );
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reports/project-summary
// Generates a clean one-page PDF of ONLY what is displayed on ProjectDetailsPage:
// project name, provider, created date, total scans, latest score,
// total resources, total issues, and the severity bar chart.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/project-summary', async (req, res) => {
  try {
    const {
      projectName,
      projectId,
      provider,
      createdAt,
      totalScans,
      latestScore,
      totalResources,
      totalIssues,
      totalCritical,
      totalHigh,
      totalMedium,
    } = req.body;

    if (!projectName) {
      return res.status(400).json({ error: 'projectName is required.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // ── Build the PDF ──────────────────────────────────────────────────────
    const doc    = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));

    const pdfBuf = await new Promise((resolve, reject) => {
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W       = doc.page.width;
      const indigo  = '#4f46e5';
      const violet  = '#7c3aed';
      const dark    = '#0f172a';
      const slate50 = '#f8fafc';
      const slate100= '#f1f5f9';
      const slate200= '#e2e8f0';
      const slate500= '#64748b';
      const slate700= '#334155';
      const slate800= '#1e293b';

      const provLabel = {
        gcp:   'Google Cloud Platform',
        aws:   'Amazon Web Services',
        azure: 'Microsoft Azure',
      }[provider?.toLowerCase()] || (provider || 'Cloud').toUpperCase();

      const scoreNum = latestScore ?? 0;
      const scoreCol = scoreNum > 80 ? '#16a34a' : scoreNum > 50 ? '#ca8a04' : '#dc2626';

      // ── HEADER BAND ──────────────────────────────────────────────────────
      doc.rect(0, 0, W, 90).fill(dark);

      // Logo text
      doc.fontSize(20).fillColor('#ffffff').text('Audit', 50, 28, { continued: true });
      doc.fillColor(indigo).text('Scope');

      // Subtitle
      doc.fontSize(9).fillColor('#94a3b8')
         .text('Project Summary Report', 50, 56);

      // Generated meta (top-right)
      const meta = `Generated: ${new Date().toLocaleString()}  |  By: ${user.name || user.email}`;
      doc.fontSize(7.5).fillColor('#64748b').text(meta, W - 260, 76, { width: 210, align: 'right' });

      // Provider badge (top-right below meta)
      doc.roundedRect(W - 120, 28, 70, 18, 4).fill('rgba(99,102,241,0.3)');
      doc.fontSize(8).fillColor('#a5b4fc')
         .text(provLabel.split(' ')[0], W - 115, 33, { width: 60, align: 'center' });

      let y = 108; // content starts here

      // ── PROJECT INFO BLOCK ────────────────────────────────────────────────
      doc.roundedRect(50, y, W - 100, 64, 8).fill(slate100);

      // Left: name + provider chip
      doc.fontSize(16).fillColor(slate800).text(projectName, 66, y + 10, { width: W - 200 });

      // Provider chip
      const chipX = 66;
      doc.roundedRect(chipX, y + 34, 80, 16, 8).fill(indigo + '22');
      doc.fontSize(7.5).fillColor(indigo).text(provLabel, chipX + 4, y + 38, { width: 72, align: 'center' });

      // Right: Project ID + Created date
      const rightX = W - 185;
      doc.fontSize(7.5).fillColor(slate500).text('Project ID', rightX, y + 10);
      doc.fontSize(8.5).fillColor(slate700).text(projectId || projectName, rightX, y + 22, { width: 130 });
      doc.fontSize(7.5).fillColor(slate500).text('Created', rightX, y + 40);
      const dateStr = createdAt
        ? new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : '—';
      doc.fontSize(8.5).fillColor(slate700).text(dateStr, rightX, y + 52, { width: 130 });

      y += 76;

      // ── SECTION LABEL ────────────────────────────────────────────────────
      doc.fontSize(9).fillColor(slate500)
         .text('SUMMARY METRICS', 50, y, { characterSpacing: 1 });
      doc.moveTo(50, y + 14).lineTo(W - 50, y + 14).strokeColor(slate200).lineWidth(0.8).stroke();
      y += 22;

      // ── 4 STAT BOXES ─────────────────────────────────────────────────────
      const stats = [
        { label: 'TOTAL SCANS',      value: String(totalScans ?? 0),            color: indigo,    bg: '#eef2ff' },
        { label: 'LATEST SCORE',     value: `${scoreNum}%`,                     color: scoreCol,  bg: slate50   },
        { label: 'TOTAL RESOURCES',  value: (totalResources ?? 0).toLocaleString(), color: '#059669', bg: '#ecfdf5' },
        { label: 'TOTAL ISSUES',     value: (totalIssues ?? 0).toLocaleString(), color: totalIssues > 0 ? '#dc2626' : '#059669', bg: totalIssues > 0 ? '#fef2f2' : '#ecfdf5' },
      ];

      const boxW = (W - 100 - 27) / 4; // 3 gaps of 9px
      stats.forEach((s, i) => {
        const bx = 50 + i * (boxW + 9);
        // Card
        doc.roundedRect(bx, y, boxW, 58, 7).fill(s.bg);
        // Top colour bar
        doc.roundedRect(bx, y, boxW, 3.5, 2).fill(s.color);
        // Value
        doc.fontSize(22).fillColor(s.color).text(s.value, bx + 8, y + 12, { width: boxW - 16, align: 'center' });
        // Label
        doc.fontSize(6.5).fillColor(slate500).text(s.label, bx + 4, y + 42, { width: boxW - 8, align: 'center', characterSpacing: 0.5 });
      });

      y += 68;

      // ── SECTION LABEL ────────────────────────────────────────────────────
      doc.fontSize(9).fillColor(slate500)
         .text('VULNERABILITY BREAKDOWN  (cumulative across all scans)', 50, y, { characterSpacing: 0.5 });
      doc.moveTo(50, y + 14).lineTo(W - 50, y + 14).strokeColor(slate200).lineWidth(0.8).stroke();
      y += 22;

      // ── SEVERITY CHIPS ROW ────────────────────────────────────────────────
      const sevItems = [
        { label: 'Critical', value: totalCritical ?? 0, color: '#dc2626', bg: '#fef2f2' },
        { label: 'High',     value: totalHigh     ?? 0, color: '#ea580c', bg: '#fff7ed' },
        { label: 'Medium',   value: totalMedium   ?? 0, color: '#ca8a04', bg: '#fefce8' },
      ];
      const chipW = 100, chipH = 36, chipGap = 16;
      const rowX  = 50;
      sevItems.forEach((sv, i) => {
        const cx = rowX + i * (chipW + chipGap);
        doc.roundedRect(cx, y, chipW, chipH, 6).fill(sv.bg);
        doc.roundedRect(cx, y, chipW, 3, 2).fill(sv.color);
        doc.fontSize(16).fillColor(sv.color).text(sv.value.toLocaleString(), cx, y + 8, { width: chipW, align: 'center' });
        doc.fontSize(7).fillColor(sv.color).text(sv.label, cx, y + 26, { width: chipW, align: 'center' });
      });

      y += chipH + 20;

      // ── BAR CHART ─────────────────────────────────────────────────────────
      const chartH  = 100;
      const chartW  = W - 100;
      const maxV    = Math.max(totalCritical ?? 0, totalHigh ?? 0, totalMedium ?? 0, 1);
      const barW2   = 44;
      const barGap  = (chartW - sevItems.length * barW2) / (sevItems.length + 1);

      // Y-axis grid lines (4 ticks)
      for (let t = 0; t <= 4; t++) {
        const ty = y + chartH - (t / 4) * chartH;
        const tv = Math.round((maxV / 4) * t);
        doc.moveTo(50, ty).lineTo(50 + chartW, ty)
           .strokeColor(slate200).lineWidth(0.5).stroke();
        doc.fontSize(7).fillColor(slate500).text(tv.toLocaleString(), 30, ty - 4, { width: 18, align: 'right' });
      }

      // Bars
      sevItems.forEach((sv, i) => {
        const bx = 50 + barGap + i * (barW2 + barGap);
        const bh = maxV > 0 ? ((sv.value / maxV) * chartH) : 0;
        const by = y + chartH - bh;

        // Shadow bar (background)
        doc.roundedRect(bx, y, barW2, chartH, 4).fill(sv.bg);
        // Actual bar
        if (bh > 0) doc.roundedRect(bx, by, barW2, bh, 4).fill(sv.color);
        // Value label on top of bar
        doc.fontSize(9).fillColor(sv.color)
           .text(sv.value.toLocaleString(), bx - 4, by - 14, { width: barW2 + 8, align: 'center' });
        // X-axis label
        doc.fontSize(8).fillColor(slate700)
           .text(sv.label, bx - 4, y + chartH + 6, { width: barW2 + 8, align: 'center' });
      });

      // X + Y axis lines
      doc.moveTo(50, y).lineTo(50, y + chartH).strokeColor(slate500).lineWidth(0.8).stroke();
      doc.moveTo(50, y + chartH).lineTo(50 + chartW, y + chartH).strokeColor(slate500).lineWidth(0.8).stroke();

      y += chartH + 28;

      // ── NO FINDINGS NOTE (if zero) ────────────────────────────────────────
      if ((totalIssues ?? 0) === 0) {
        doc.roundedRect(50, y, W - 100, 32, 6).fill('#ecfdf5');
        doc.fontSize(11).fillColor('#16a34a')
           .text('✓  No vulnerabilities found across all scans. Infrastructure looks secure!', 62, y + 10, { width: W - 124 });
        y += 44;
      }

      // ── FOOTER ────────────────────────────────────────────────────────────
      const footerY = doc.page.height - 36;
      doc.moveTo(50, footerY - 8).lineTo(W - 50, footerY - 8).strokeColor(slate200).lineWidth(0.5).stroke();
      doc.fontSize(7.5).fillColor(slate500)
         .text(
           'AuditScope — Automated Cloud Security Platform  |  Confidential',
           50, footerY,
           { align: 'center', width: W - 100 }
         );

      doc.end();
    });

    const filename = `AuditScope_${projectName.replace(/\s+/g, '_')}_Summary_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuf.length);
    res.send(pdfBuf);

    console.log(`[Report] Project summary PDF downloaded for "${projectName}" by ${user.email}`);

  } catch (err) {
    console.error('[Report] project-summary error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate project summary PDF.' });
  }
});

router.generatePDF = generatePDF;
module.exports = router;
