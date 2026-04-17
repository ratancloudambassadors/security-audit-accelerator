const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function get() {
    const scans = await prisma.scanHistory.findMany();
    console.log('Total Scans:', scans.length);
    let size = 0;
    scans.forEach(s => size += s.findings.length);
    console.log('Total JSON size:', (size/1024/1024).toFixed(2), 'MB');
}
get().catch(console.error).finally(()=>prisma.$disconnect());
