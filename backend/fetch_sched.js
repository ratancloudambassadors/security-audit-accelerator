const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function get() {
    const schedules = await prisma.auditSchedule.findMany({ 
        where: { createdAt: { gte: new Date('2026-04-17T00:00:00.000Z') } } 
    });
    console.log("Schedules created today:", schedules.length);
    console.log(JSON.stringify(schedules, null, 2));
}
get().catch(console.error).finally(() => prisma.$disconnect());
