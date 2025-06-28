console.log('Node.js version:', process.version);
console.log('NPM version check...');
const { execSync } = require('child_process');
try {
  const npmVersion = execSync('npm -v', { encoding: 'utf8' }).trim();
  console.log('NPM version:', npmVersion);
} catch (error) {
  console.log('NPM version check failed:', error.message);
}
console.log('Current directory:', process.cwd());
console.log('Environment check completed'); 