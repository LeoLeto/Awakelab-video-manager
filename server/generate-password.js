import bcrypt from 'bcrypt';
import crypto from 'crypto';

console.log('\n🔐 Password Hash Generator\n');
console.log('='.repeat(50));

// Generate a strong JWT secret
const jwtSecret = crypto.randomBytes(32).toString('hex');
console.log('\n✅ Generated JWT Secret:');
console.log(jwtSecret);
console.log('\nAdd this to your .env file:');
console.log(`JWT_SECRET=${jwtSecret}\n`);

// Demo: Generate hashes for common passwords
const demoPasswords = [
  { username: 'admin', password: 'password123' },
  { username: 'manager', password: 'password123' }
];

console.log('='.repeat(50));
console.log('\n📝 Demo User Credentials (CHANGE THESE!):\n');

const generateHash = async (username, password, index) => {
  const hash = await bcrypt.hash(password, 10);
  console.log(`USER_${index}=${username}:${hash}`);
};

const generateAll = async () => {
  for (let i = 0; i < demoPasswords.length; i++) {
    await generateHash(demoPasswords[i].username, demoPasswords[i].password, i + 1);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('\n💡 To generate a hash for your own password:');
  console.log('   node -e "import bcrypt from \'bcrypt\'; bcrypt.hash(\'YourPassword\', 10).then(hash => console.log(hash));"');
  console.log('\n🔒 Security Tips:');
  console.log('   • Never commit your .env file to Git');
  console.log('   • Use strong, unique passwords');
  console.log('   • Change the default credentials immediately');
  console.log('   • Store your .env file securely\n');
};

generateAll().catch(console.error);
