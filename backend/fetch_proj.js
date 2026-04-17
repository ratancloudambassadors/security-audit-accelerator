const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function get() {
    const p = await prisma.project.findUnique({ where: { id: '69e1b4fdb1b78a4029641a34' } });
    console.log(p);
}
get().catch(console.error).finally(()=>prisma.$disconnect());
