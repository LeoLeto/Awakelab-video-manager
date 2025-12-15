// Script to generate bcrypt hashed passwords
// Usage: node generatePassword.js <password>

import bcrypt from 'bcrypt';

const password = process.argv[2];

if (!password) {
  console.error('❌ Please provide a password as an argument');
  console.log('Usage: node generatePassword.js <password>');
  process.exit(1);
}

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('❌ Error generating hash:', err);
    process.exit(1);
  }
  
  console.log('\n✅ Password hashed successfully!\n');
  console.log('Add this to your .env file:');
  console.log(`USER_N=username:${hash}`);
  console.log('\n(Replace "username" with the actual username and "N" with the next available number)\n');
});
