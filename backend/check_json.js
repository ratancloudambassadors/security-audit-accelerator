const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function get() {
    const scans = await prisma.scanHistory.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, findings: true } });
    for (const scan of scans) {
        try {
            JSON.parse(scan.findings);
        } catch (e) {
            console.log("Invalid JSON in scan:", scan.id);
        }
    }
    console.log("Checked latest 5 scans.");
}
get().catch(console.error).finally(()=>prisma.$disconnect());
