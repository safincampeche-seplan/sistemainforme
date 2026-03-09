import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function checkUsers() {
    try {
        console.log('--- Searching for saluddemo@seplan.gob.mx ---');
        const saluddemo = await prisma.$queryRawUnsafe(`SELECT id, email, name FROM users WHERE email = 'saluddemo@seplan.gob.mx'`);
        console.log('saluddemo found:', saluddemo.length > 0 ? saluddemo[0].email : 'NOT FOUND');
        console.log('\n--- Finding all Admin users ---');
        const adminUsers = await prisma.$queryRawUnsafe(`
            SELECT u.id, u.email, u.name, r.name as role_name
            FROM users u
            JOIN model_has_roles mhr ON mhr.model_id = u.id
            JOIN roles r ON r.id = mhr.role_id
            WHERE r.name IN ('SuperAdministrador', 'Administrador', 'super_admin')
        `);
        console.log('Admin Users:', JSON.stringify(adminUsers, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
        if (adminUsers.length === 0) {
            console.log('\nNo users found with admin roles in model_has_roles. Checking roles table...');
            const allRoles = await prisma.$queryRawUnsafe(`SELECT id, name FROM roles`);
            console.log('All Roles:', JSON.stringify(allRoles, null, 2));
        }
    }
    catch (error) {
        console.error('Error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkUsers();
//# sourceMappingURL=check_admin.js.map