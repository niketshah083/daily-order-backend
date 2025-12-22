import * as bcrypt from 'bcrypt';

async function hashPassword(password: string) {
  const hash = await bcrypt.hash(password, 10);
  console.log(`Password: ${password}`);
  console.log(`Hashed: ${hash}`);
  console.log('\nUse this hash in your SQL INSERT statement.');
}

const password = process.argv[2] || 'admin123';
hashPassword(password);
