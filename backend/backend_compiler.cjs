const { execSync } = require('child_process');

try {
  // Use module16 explicitly to allow import.meta
  execSync('npx tsc src/index.ts --rootDir src --outDir dist --module nodenext --target es2022 --moduleResolution nodenext --skipLibCheck --esModuleInterop', { stdio: 'inherit' });
  console.log("Compiled successfully!");
  execSync('pm2 restart seplan-backend-3001', { stdio: 'inherit' });
} catch(e) {
  console.error("Compilation failed", e.message);
}
