const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function get() {
    try {
        await prisma.scanHistory.create({
            data: {
                score: 100, scannedResources: 1, totalChecks: 1, skippedChecks: '[]',
                criticalCount: 0, highCount: 0, mediumCount: 0, findings: '[]',
                projectId: '69e1b4fdb1b78a4029641a34'
            }
        });
        console.log('success');
    } catch(e) {
        console.error('Error:', e.message);
    }
}
get().catch(console.error).finally(()=>prisma.$disconnect());
