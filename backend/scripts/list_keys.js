import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function v() {
    console.log('--- Prisma Keys ---');
    const keys = Object.keys(p).filter(k => !k.startsWith('$'));
    console.log(JSON.stringify(keys, null, 2));
    console.log('--- End ---');
}
v().finally(() => p.$disconnect());
//# sourceMappingURL=list_keys.js.map