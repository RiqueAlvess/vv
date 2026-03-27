import bcrypt from 'bcryptjs';

const password = process.argv[2] || 'pokemon.230H';

const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log(`\nPassword: ${password}`);
console.log(`Hash: ${hash}\n`);
