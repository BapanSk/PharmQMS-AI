const bcrypt = require('bcrypt');

async function main() {
  const password = process.argv[2];
  if (!password) {
    process.stderr.write('Usage: node server/utils/hashPassword.js <password>\n');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  process.stdout.write(`${hash}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
