import { hashPassword } from '@/lib/auth';

async function main() {
  const password = process.argv[2] || 'alterarsenha123';
  const hash = await hashPassword(password);

  console.log(`\nPassword: ${password}`);
  console.log(`Hash: ${hash}\n`);
}

main().catch(console.error);
