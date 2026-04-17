const fs = require('fs');
const path = require('path');

function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (full.endsWith('.jsx')) {
            let content = fs.readFileSync(full, 'utf8');
            let modified = false;
            
            // Replaces SVG with dimensions explicitly captured
            const updated = content.replace(/<svg[^>]*width=["'](\d+)["'][^>]*height=["'](\d+)["'][^>]*>.*?<\/svg>/gs, (match, w, h) => {
                if (match.includes('4285F4') || match.includes('EA4335')) {
                    modified = true;
                    return `<img src="/assets/gcp-logo.svg" alt="GCP" width="${w}" height="${h}" />`;
                }
                if (match.includes('FF9900') || match.includes('232F3E')) {
                    modified = true;
                    return `<img src="/assets/aws-logo.svg" alt="AWS" width="${w}" height="${h}" />`;
                }
                if (match.includes('0078D4') || match.includes('0072C6')) {
                    modified = true;
                    return `<img src="/assets/azure-logo.svg" alt="Azure" width="${w}" height="${h}" />`;
                }
                return match;
            });
            
            if (modified) {
                fs.writeFileSync(full, updated);
                console.log('Replaced SVGs in', full);
            }
        }
    }
}
walk('./src');
