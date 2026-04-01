// ⚠️  Development seed only. Do NOT run against production databases.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding admin user and company...');

  // 1. Upsert the admin company
  const company = await prisma.company.upsert({
    where: { cnpj: '00.000.000/0000-00' },
    update: {},
    create: {
      name: 'Empresa Admin',
      cnpj: '00.000.000/0000-00',
    },
  });

  console.log(`✓ Company: ${company.name} (${company.id})`);

  // 2. Hash the password
  const passwordHash = await bcrypt.hash('administrador.230H', 12);

  // 3. Upsert the admin user
  const user = await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    update: {
      password_hash: passwordHash,
      role: 'ADM',
      active: true,
    },
    create: {
      name: 'Administrador',
      email: 'admin@admin.com',
      password_hash: passwordHash,
      role: 'ADM',
      active: true,
      company_id: company.id,
    },
  });

  console.log(`✓ User: ${user.email} | role: ${user.role} (${user.id})`);
  console.log('');
  console.log('Admin credentials:');
  console.log('  Email:    admin@admin.com');
  console.log('  Password: administrador.230H');
  console.log('');
  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
