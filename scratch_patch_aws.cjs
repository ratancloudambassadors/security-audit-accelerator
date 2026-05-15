const fs = require('fs');

let content = fs.readFileSync('./backend/services/awsScanner.js', 'utf8');

// Add array
content = content.replace(/const findings = \[\];/g, 'const findings = [];\n  const scannedResourceList = [];');

// Add return
content = content.replace(/return \{ findings, scannedCount \};/g, 'return { findings, scannedCount, scannedResourceList };');
content = content.replace(/return\s*\{\s*findings,\s*scannedCount\s*\}/g, 'return { findings, scannedCount, scannedResourceList }');

// Inject push
const pushStmt = `scannedCount++;\n          scannedResourceList.push({ service: 'AWS', name: 'AWS Resource' });`;
content = content.replace(/scannedCount\+\+;/g, pushStmt);

fs.writeFileSync('./backend/services/awsScanner.js', content);
console.log('Patched awsScanner.js');
