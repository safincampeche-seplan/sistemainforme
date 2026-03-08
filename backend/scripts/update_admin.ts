import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateAdmin() {
    try {
        console.log('--- Updating user with ID 1 to admin@seplan.gob.mx ---');
        const result = await prisma.$executeRawUnsafe(
            "UPDATE users SET email = 'admin@seplan.gob.mx' WHERE id = 1"
        );
        console.log('Operation successful. Rows affected:', result);

        const updated = await prisma.$queryRawUnsafe("SELECT id, email, name FROM users WHERE id = 1");
        console.log('Updated user data:', JSON.stringify(updated, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    } catch (e) {
        console.error('Failed to update admin email:', e);
    } finally {
        await prisma.$disconnect();
    }
}

updateAdmin();
