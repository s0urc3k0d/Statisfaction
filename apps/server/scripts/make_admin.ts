import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const login = process.argv[2] || 'lantredesilver';
  const u = await prisma.user.findFirst({ where: { OR: [ { login }, { displayName: login } ] } });
  if (!u) {
    console.error(`Utilisateur introuvable par login/displayName='${login}'.`);
    process.exit(1);
  }
  await prisma.user.update({ where: { id: u.id }, data: { isAdmin: true } });
  console.log(`OK: ${login} (id=${u.id}) est maintenant admin.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
