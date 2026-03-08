import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_seplan_2024';

async function main() {
    try {
        const users = await prisma.user.findMany({
            where: { email: { contains: 'salud' } },
            include: { dependency: true }
        });

        console.log(`Found ${users.length} salud users.`);
        if (users.length === 0) return;

        const userFound = users[0];
        console.log("Testing login for:", userFound.email);

        const userRolesRes: any[] = await (prisma as any).$queryRawUnsafe(`
            SELECT r.name 
            FROM model_has_roles mhr 
            JOIN roles r ON r.id = mhr.role_id 
            WHERE mhr.model_id = ?
        `, userFound.id);
        const roles = userRolesRes.map(r => r.name);

        console.log("Roles DB:", roles);

        const token = jwt.sign(
            {
                id: userFound.id.toString(),
                email: userFound.email,
                roles: roles,
                dependency: userFound.dependency?.acronym,
                dependency_id: userFound.dependency_id ? userFound.dependency_id.toString() : null
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        console.log("JWT Success.");
    } catch (e) {
        console.error("ERROR DETECTED:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
