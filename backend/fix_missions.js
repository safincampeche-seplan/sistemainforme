import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const missions4 = await prisma.$queryRawUnsafe(`SELECT * FROM cat_missions WHERE narrative_period_id = 4`);
  console.log("Found missions for period 4:", missions4.length);

  for (const m of missions4) {
    const exists = await prisma.$queryRawUnsafe(`SELECT * FROM cat_missions WHERE code = ? AND narrative_period_id = 5`, m.code);
    if (exists.length === 0) {
      await prisma.$queryRawUnsafe(`INSERT INTO cat_missions (name, code, narrative_period_id, title_color, theme_color, subtheme_color) VALUES (?, ?, ?, ?, ?, ?)`, m.name, m.code, 5, m.title_color, m.theme_color, m.subtheme_color);
      console.log("Created mission", m.code, "for period 5");
    } else {
      console.log("Mission", m.code, "already exists for period 5");
    }
  }
}
main().finally(() => prisma.$disconnect());
