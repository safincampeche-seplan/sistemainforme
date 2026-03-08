import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const m = await prisma.$queryRawUnsafe(`SELECT * FROM cat_missions LIMIT 1`);
    console.log("cat_missions records:", m.length, m.length > 0 ? Object.keys(m[0]) : "[]");

    const o = await prisma.$queryRawUnsafe(`SELECT * FROM cat_objectives LIMIT 1`);
    console.log("cat_objectives records:", o.length, o.length > 0 ? Object.keys(o[0]) : "[]");

    const s = await prisma.$queryRawUnsafe(`SELECT * FROM cat_narrative_strategies LIMIT 1`);
    console.log("cat_strategies records:", s.length, s.length > 0 ? Object.keys(s[0]) : "[]");

    const a = await prisma.$queryRawUnsafe(`SELECT * FROM cat_action_lines LIMIT 1`);
    console.log("cat_action_lines records:", a.length, a.length > 0 ? Object.keys(a[0]) : "[]");
  } catch (err) {
    console.error("DB Query error:", err.message);
  }
}
main().finally(() => prisma.$disconnect());
