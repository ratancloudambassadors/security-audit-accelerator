const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('http://localhost:5000')) {
        let modified = false;
        
        // Single line format
        const regex1 = /const API_BASE = window\.location\.hostname\.includes\('run\.app'\)\s*\?\s*'http:\/\/localhost:5000'\s*:\s*'http:\/\/localhost:5000';/g;
        if (regex1.test(content)) {
            content = content.replace(regex1, "const API_BASE = window.location.hostname.includes('run.app') ? 'https://security-audit-accelerator-backend-196053730058.asia-south1.run.app' : 'http://localhost:5000';");
            modified = true;
        }

        // Multi line format
        const regex2 = /const API_BASE = window\.location\.hostname\.includes\('run\.app'\)\s*[\n\r]+\s*\?\s*'http:\/\/localhost:5000'\s*[\n\r]+\s*:\s*'http:\/\/localhost:5000';/g;
        if (regex2.test(content)) {
            content = content.replace(regex2, "const API_BASE = window.location.hostname.includes('run.app')\n                ? 'https://security-audit-accelerator-backend-196053730058.asia-south1.run.app'\n                : 'http://localhost:5000';");
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log('Restored: ' + filePath);
        }
    }
}

function restoreDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            restoreDir(filePath);
        } else if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
            processFile(filePath);
        }
    }
}

restoreDir('e:/Security_audit-2/Security_audit-2/security-audit-accelerator/src');
