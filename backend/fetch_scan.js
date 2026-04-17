const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function get() {
    const s = await prisma.scanHistory.findMany({ 
        orderBy: { createdAt: 'desc' }, 
        take: 3, 
        select: { id: true, score: true, scannedResources: true, criticalCount: true, createdAt: true, projectId: true } 
    });
    console.log(JSON.stringify(s, null, 2));
}
get().catch(console.error).finally(()=>prisma.$disconnect());
