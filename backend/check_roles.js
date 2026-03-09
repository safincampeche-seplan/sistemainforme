import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function checkRoles() {
    try {
        console.log("--- ROLES DISPONIBLES EN DB ---");
        const roles = await prisma.$queryRawUnsafe('SELECT name FROM roles');
        console.log(roles);
        console.log("\n--- USUARIO saluddemo@seplan.gob.mx ---");
        const user = await prisma.user.findUnique({
            where: { email: 'saluddemo@seplan.gob.mx' },
            select: { id: true, email: true, name: true }
        });
        if (user) {
            console.log("Usuario encontrado:", user);
            const userRoles = await prisma.$queryRawUnsafe(`
                SELECT r.name 
                FROM roles r 
                JOIN model_has_roles mhr ON mhr.role_id = r.id 
                WHERE mhr.model_id = ?
            `, user.id);
            console.log("Roles del usuario:", userRoles);
        }
        else {
            console.log("Usuario saluddemo no encontrado en DB.");
        }
    }
    catch (e) {
        console.error("Error:", e);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkRoles();
//# sourceMappingURL=check_roles.js.map