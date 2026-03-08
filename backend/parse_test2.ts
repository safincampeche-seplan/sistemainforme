import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const user = await prisma.user.findFirst({
        where: { email: 'saluddemo@seplan.gob.mx' }
    });
    console.log(user);
    await prisma.$disconnect();
}
run();
