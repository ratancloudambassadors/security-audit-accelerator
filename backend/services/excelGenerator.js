const ExcelJS = require('exceljs');

/**
 * Maps finding IDs to Cloud Service Categories
 */
const getCategoryFromId = (id) => {
    if (!id) return 'General';
    const prefix = id.split('-')[1] || '';
    switch (prefix.toUpperCase()) {
        case 'IAM': return 'IAM';
        case 'STORAGE': return 'Storage';
        case 'KMS': return 'KMS';
        case 'SQL': return 'Cloud SQL';
        case 'NET':
        case 'DNS':
        case 'FIREWALL': return 'Networking';
        case 'COMPUTE':
        case 'VM': return 'Compute';
        case 'LOG':
        case 'MONITOR': return 'Logging';
        case 'GKE': return 'GKE';
        case 'CLOUDRUN':
        case 'FUNCTION': return 'Serverless';
        case 'LB': return 'Load Balancers';
        case 'BQ':
        case 'BIGQUERY': return 'BigQuery';
        case 'DATAPROC': return 'Dataproc';
        case 'RDS': return 'AWS RDS';
        case 'EKS': return 'AWS EKS';
        default: return 'General';
    }
};

/**
 * Maps finding IDs to human-readable Checkpoint names
 */
const getCheckpointName = (id) => {
    if (!id) return 'General Check';
    const parts = id.split('-');
    const checkType = parts[2] ? parts[2].toUpperCase() : 'GENERAL';
    
    const mapping = {
        'PUBLIC':     'Check Public Access',
        'EXTERNAL':   'Check External Access',
        'ENCRYPTION': 'Check Encryption',
        'ROTATION':   'Check Key Rotation',
        'ADMIN':      'Check Admin Access',
        'SOD':        'Check Separation of Duties',
        'TOKEN':      'Check SA Tokens',
        'KEY':        'Check SA Keys',
        'SSL':        'Check SSL Policy',
        'IP':         'Check IP Config',
        'LOG':        'Check Logging',
        'LBLOG':      'Check LB Logging',
        'MONITOR':    'Check Monitoring',
        'FIREWALL':   'Check Firewall Rules',
        'VERSION':    'Check Software Version',
        'SA':         'Check Service Accounts',
        'GKE':        'Check Kubernetes',
        'FLOW':       'Check VPC Flow Logs',
        'ENDPOINT':   'Check API Endpoint',
        'ABAC':       'Check Legacy ABAC',
        'WORKLOAD':   'Check Workload Identity',
        'SHIELDED':   'Check Shielded Nodes',
        'BINARY':     'Check Binary Auth',
        'RDS':        'Check RDS Public',
        'EKS':        'Check EKS Public',
        'SERVERLESS': 'Check Serverless',
        'DATASET':    'Check BigQuery Dataset'
    };

    return mapping[checkType] || `Check: ${checkType}`;
};

// ── Shared style helpers ──────────────────────────────────────────────────────
const COLORS = {
    darkHeader:  '1E293B',
    indigo:      '4F46E5',
    indigoBg:    'EEF2FF',
    slate50:     'F8FAFC',
    slate100:    'F1F5F9',
    slate200:    'E2E8F0',
    slate600:    '475569',
    slate800:    '1E293B',
    red:         'DC2626',
    redBg:       'FEF2F2',
    orange:      'EA580C',
    orangeBg:    'FFF7ED',
    yellow:      'CA8A04',
    blue:        '2563EB',
    green:       '16A34A',
    greenBg:     'F0FDF4',
    greenLight:  'DCFCE7',
    greenText:   '15803D',
};

const metricCell = (ws, row, col, label, value, valueColor) => {
    const labelCell = ws.getCell(row, col);
    labelCell.value = label;
    labelCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF' + COLORS.slate600 } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.slate100 } };
    labelCell.border = { bottom: { style: 'thin', color: { argb: 'FF' + COLORS.slate200 } } };

    const valCell = ws.getCell(row, col + 1);
    valCell.value = value;
    valCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF' + (valueColor || COLORS.slate800) } };
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    valCell.border = { bottom: { style: 'thin', color: { argb: 'FF' + COLORS.slate200 } } };
};

/**
 * Generates a styled Excel report from scan data
 * @param {Object} scanData - The scan history record or data object
 * @param {string} projectName - Name of the project
 * @returns {Buffer} - Excel file buffer
 */
const generateExcelReport = async (scanData, projectName) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CA AuditScope';
    workbook.lastModifiedBy = 'CA AuditScope';
    workbook.created = new Date();
    workbook.modified = new Date();

    // ── Resolve data ──────────────────────────────────────────────────────────
    const vulnerabilities = Array.isArray(scanData.vulnerabilities)
        ? scanData.vulnerabilities
        : (typeof scanData.findings === 'string' ? JSON.parse(scanData.findings) : []);

    const passedResources = Array.isArray(scanData.passedResources) ? scanData.passedResources : [];

    const scanned    = scanData.scannedResources || scanData.scanned || 0;
    const vulnResSet = new Set(vulnerabilities.map(v => v.resource));
    const vulnResCnt = vulnResSet.size;
    const securedCnt = passedResources.length;
    const secPct     = scanned > 0 ? Math.round((securedCnt / scanned) * 100) : 0;

    const critCount = vulnerabilities.filter(v => v.severity === 'Critical').length;
    const highCount = vulnerabilities.filter(v => v.severity === 'High').length;
    const medCount  = vulnerabilities.filter(v => v.severity === 'Medium').length;
    const lowCount  = vulnerabilities.filter(v => v.severity === 'Low').length;

    const totalChecks = scanData.totalChecks || 77;
    const skippedArr  = (() => {
        try {
            if (!scanData.skippedChecks) return [];
            return typeof scanData.skippedChecks === 'string'
                ? JSON.parse(scanData.skippedChecks)
                : (Array.isArray(scanData.skippedChecks) ? scanData.skippedChecks : []);
        } catch(e) { return []; }
    })();
    const completedChecks = totalChecks - skippedArr.length;
    const qualityPct = Math.round((completedChecks / totalChecks) * 100);

    // ── 1. SUMMARY SHEET ─────────────────────────────────────────────────────
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
        { key: 'metric', width: 32 },
        { key: 'value',  width: 38 }
    ];

    // Title row
    summarySheet.mergeCells('A1:B1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = `CA AuditScope — Security Audit Report: ${projectName}`;
    titleCell.font  = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.darkHeader } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 36;

    // Sub-header: scan date
    summarySheet.mergeCells('A2:B2');
    const subCell = summarySheet.getCell('A2');
    subCell.value = `Scan Date: ${new Date(scanData.createdAt || Date.now()).toLocaleString()}   |   Provider: ${(scanData.provider || 'Cloud').toUpperCase()}   |   Project: ${projectName}`;
    subCell.font  = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF' + COLORS.slate600 } };
    subCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.slate100 } };
    subCell.alignment = { horizontal: 'center' };
    summarySheet.getRow(2).height = 20;

    summarySheet.addRow({}); // spacer

    // Section heading helper
    const sectionHeading = (ws, rowNum, label) => {
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const cell = ws.getCell(`A${rowNum}`);
        cell.value = label;
        cell.font  = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF' + COLORS.indigo }, italic: false };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.indigoBg } };
        cell.alignment = { horizontal: 'left', indent: 1 };
        ws.getRow(rowNum).height = 18;
    };

    // ── Overview metrics (matching dashboard 4 cards) ──
    sectionHeading(summarySheet, 4, '  AUDIT OVERVIEW');
    metricCell(summarySheet, 5,  1, 'Total Vulnerabilities',  vulnerabilities.length,  COLORS.red);
    metricCell(summarySheet, 6,  1, 'Resources Audited',      scanned,                 COLORS.slate800);
    metricCell(summarySheet, 7,  1, 'Vulnerable Resources',   vulnResCnt,              COLORS.orange);
    metricCell(summarySheet, 8,  1, 'Secured Resources',      `${securedCnt} / ${scanned} (${secPct}% secured)`, COLORS.green);
    metricCell(summarySheet, 9,  1, 'Security Score',         `${scanData.score || 0}%`, scanData.score > 80 ? COLORS.green : scanData.score > 50 ? COLORS.yellow : COLORS.red);
    metricCell(summarySheet, 10, 1, 'Audit Quality',          `${qualityPct}% (${completedChecks}/${totalChecks} validations)`, qualityPct > 80 ? COLORS.blue : COLORS.yellow);

    summarySheet.addRow({});

    // ── Severity breakdown ──
    sectionHeading(summarySheet, 12, '  SEVERITY BREAKDOWN');
    metricCell(summarySheet, 13, 1, 'Critical Findings', critCount, COLORS.red);
    metricCell(summarySheet, 14, 1, 'High Findings',     highCount, COLORS.orange);
    metricCell(summarySheet, 15, 1, 'Medium Findings',   medCount,  COLORS.yellow);
    metricCell(summarySheet, 16, 1, 'Low Findings',      lowCount,  COLORS.blue);

    summarySheet.addRow({});

    // ── Skipped services ──
    if (skippedArr.length > 0) {
        sectionHeading(summarySheet, 18, '  SKIPPED SERVICES');
        skippedArr.forEach((s, i) => {
            const r = summarySheet.addRow({ metric: s.service || `Service ${i + 1}`, value: s.reason || 'Skipped' });
            r.getCell(1).font = { name: 'Arial', size: 10 };
            r.getCell(2).font = { name: 'Arial', size: 10, color: { argb: 'FF' + COLORS.yellow } };
        });
    }

    // ── 2. VULNERABILITY SHEETS BY SERVICE ───────────────────────────────────
    const findingsByCategory = vulnerabilities.reduce((acc, v) => {
        const category = getCategoryFromId(v.id);
        if (!acc[category]) acc[category] = [];
        acc[category].push(v);
        return acc;
    }, {});

    Object.entries(findingsByCategory).forEach(([category, findings]) => {
        const sheetName = category.substring(0, 30);
        const sheet = workbook.addWorksheet(sheetName);

        sheet.columns = [
            { header: '#',                       key: 'idx',         width: 6  },
            { header: 'Checkpoint / Resource',   key: 'resource',    width: 42 },
            { header: 'ID',                      key: 'id',          width: 25 },
            { header: 'Severity',                key: 'severity',    width: 12 },
            { header: 'Issue Description',       key: 'issue',       width: 55 },
            { header: 'Remediation Step',        key: 'remediation', width: 65 }
        ];

        // Main header row
        const hdrRow = sheet.getRow(1);
        hdrRow.font    = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 10 };
        hdrRow.fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.darkHeader } };
        hdrRow.height  = 22;
        hdrRow.alignment = { vertical: 'middle' };

        // Group findings by Checkpoint within Service
        const checkpoints = findings.reduce((acc, f) => {
            const cpName = getCheckpointName(f.id);
            if (!acc[cpName]) acc[cpName] = [];
            acc[cpName].push(f);
            return acc;
        }, {});

        let globalIdx = 1;

        Object.entries(checkpoints).forEach(([cpName, cpFindings]) => {
            // Checkpoint sub-header row (spans all columns)
            const headerRow = sheet.addRow({ idx: '', resource: cpName.toUpperCase() });
            headerRow.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FF' + COLORS.slate800 } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.slate100 } };
            headerRow.height = 18;
            headerRow.getCell(1).alignment = { horizontal: 'left' };
            sheet.mergeCells(`A${headerRow.number}:F${headerRow.number}`);

            // Each finding under this checkpoint
            cpFindings.forEach(f => {
                const row = sheet.addRow({
                    idx:         globalIdx++,
                    resource:    f.resource,
                    id:          f.id,
                    severity:    f.severity,
                    issue:       f.issue,
                    remediation: f.remediation
                });

                // Row number style
                row.getCell(1).font      = { name: 'Arial', size: 9, color: { argb: 'FF' + COLORS.slate600 } };
                row.getCell(1).alignment = { horizontal: 'center', vertical: 'top' };

                // Severity colour
                const sevCell = row.getCell(4);
                switch (f.severity) {
                    case 'Critical': sevCell.font = { color: { argb: 'FF' + COLORS.red },    bold: true }; break;
                    case 'High':     sevCell.font = { color: { argb: 'FF' + COLORS.orange }, bold: true }; break;
                    case 'Medium':   sevCell.font = { color: { argb: 'FF' + COLORS.yellow }, bold: true }; break;
                    case 'Low':      sevCell.font = { color: { argb: 'FF' + COLORS.blue },   bold: true }; break;
                }

                row.alignment = { vertical: 'top', wrapText: true };
            });

            // Spacer row between checkpoints
            sheet.addRow({});
        });
    });

    // ── 3. SECURED RESOURCES SHEET ────────────────────────────────────────────
    if (passedResources.length > 0) {
        const secSheet = workbook.addWorksheet('Secured Resources');

        secSheet.columns = [
            { header: '#',             key: 'idx',     width: 6  },
            { header: 'Service',       key: 'service', width: 22 },
            { header: 'Resource Name', key: 'name',    width: 70 }
        ];

        // Header row
        const secHdr = secSheet.getRow(1);
        secHdr.font   = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 10 };
        secHdr.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.greenText } };
        secHdr.height = 22;
        secHdr.alignment = { vertical: 'middle' };

        // Summary banner row
        const bannerRow = secSheet.addRow({
            idx: '', service: '',
            name: `\u2713  ${passedResources.length} out of ${scanned} resources had no vulnerability findings  (${secPct}% secured)`
        });
        bannerRow.getCell(3).font = { bold: true, size: 11, color: { argb: 'FF' + COLORS.green } };
        bannerRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.greenBg } };
        secSheet.mergeCells(`A${bannerRow.number}:C${bannerRow.number}`);
        bannerRow.height = 24;

        secSheet.addRow({}); // spacer

        // Group by service
        const secByService = {};
        passedResources.forEach(item => {
            const svc = item.service || 'Unknown Service';
            if (!secByService[svc]) secByService[svc] = [];
            secByService[svc].push(item);
        });

        Object.keys(secByService).sort().forEach(svcName => {
            const items = secByService[svcName];

            // Service header
            const svcHdr = secSheet.addRow({ idx: '', service: svcName.toUpperCase(), name: `${items.length} Secured Resource${items.length !== 1 ? 's' : ''}` });
            svcHdr.font   = { bold: true, size: 10, name: 'Arial', color: { argb: 'FF' + COLORS.greenText } };
            svcHdr.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.greenLight } };
            svcHdr.height = 18;

            // Resources in this service
            items.forEach((item, i) => {
                const row = secSheet.addRow({
                    idx:     i + 1,
                    service: svcName,
                    name:    item.name || 'Unknown Resource'
                });
                row.getCell(1).font      = { name: 'Arial', size: 9, color: { argb: 'FF' + COLORS.slate600 } };
                row.getCell(1).alignment = { horizontal: 'center' };
                row.getCell(2).font      = { name: 'Arial', size: 9.5, color: { argb: 'FF' + COLORS.slate600 } };
                row.getCell(3).font      = { name: 'Arial', size: 9.5, color: { argb: 'FF' + COLORS.greenText } };

                // Subtle alternating row fill
                if (i % 2 === 0) {
                    [1, 2, 3].forEach(c => {
                        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                    });
                } else {
                    [1, 2, 3].forEach(c => {
                        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.greenBg } };
                    });
                }
            });

            secSheet.addRow({}); // gap between services
        });
    }

    return await workbook.xlsx.writeBuffer();
};

module.exports = { generateExcelReport };
