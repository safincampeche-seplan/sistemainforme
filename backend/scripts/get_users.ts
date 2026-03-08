import { PrismaClient } from '../prisma/generated/client';
const prisma = new PrismaClient();

async function main() {
    const roles = ['Capturista', 'Administrador', 'Validador'];
    const result: Record<string, string> = {};
    for (const role of roles) {
        const ur = await prisma.user_roles.findFirst({
            where: { roles: { name: role } },
            include: { users: true }
        });
        if (ur && ur.users) result[role] = ur.users.email;
    }
    console.log(JSON.stringify(result, null, 2));
}
main().finally(() => prisma.$disconnect());
