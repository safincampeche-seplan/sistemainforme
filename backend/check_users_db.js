
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const userCount = await prisma.user.count();
        const users = await prisma.user.findMany({
            take: 5,
            select: {
                id: true,
                email: true,
                name: true,
                is_active: true
            }
        });
        console.log(`Total users in database: ${userCount}`);
        console.log('User list (first 5):', JSON.stringify(users, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value, 2));
    } catch (error) {
        console.error('Error querying users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
