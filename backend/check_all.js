const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function get() {
    const scans = await prisma.scanHistory.findMany({ select: { id: true, findings: true } });
    let ok = true;
    for (const scan of scans) {
        try {
            JSON.parse(scan.findings);
        } catch (e) {
            ok = false;
            console.log('Invalid JSON in scan:', scan.id);
        }
    }
    if (ok) console.log('All 67 scans are valid JSON!');
}
get().catch(console.error).finally(()=>prisma.$disconnect());
