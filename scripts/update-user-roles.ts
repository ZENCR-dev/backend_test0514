import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const queries = [
    `UPDATE "users" SET role='practitioner' WHERE role::text='doctor';`,
    `UPDATE "users" SET role='pharmacy_operator' WHERE role::text='pharmacy';`,
  ];

  for (const sql of queries) {
    const result = await prisma.$executeRawUnsafe(sql);
    console.log(`✔ SQL executed (${result} rows): ${sql}`);
  }
}

main()
  .catch((err) => {
    console.error('❌ Role update failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 