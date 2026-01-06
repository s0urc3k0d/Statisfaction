// Exécutable en production (CommonJS) sans ts-node
'use strict';
const path = require('path');
const dotenv = require('dotenv');
// Charge toujours l'env depuis apps/server/.env (indépendant du CWD)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const login = process.argv[2] || 'lantredesilver';
  const u = await prisma.user.findFirst({
    where: { OR: [{ login }, { displayName: login }] },
  });
  if (!u) {
    console.error(`Utilisateur introuvable par login/displayName='${login}'.`);
    process.exit(1);
  }
  await prisma.user.update({ where: { id: u.id }, data: { isAdmin: true } });
  console.log(`OK: ${login} (id=${u.id}) est maintenant admin.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
