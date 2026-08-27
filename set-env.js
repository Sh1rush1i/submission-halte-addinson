const fs = require('fs');

const targetFolder = './src/environments';
const envProdPath = `${targetFolder}/environment.production.ts`;
const envDefaultPath = `${targetFolder}/environment.ts`;

if (!fs.existsSync(targetFolder)) {
  console.log(`Folder ${targetFolder} tidak ditemukan. Membuat folder baru...`);
  fs.mkdirSync(targetFolder, { recursive: true });
}

const envConfigFile = `
export const environment = {
  production: true,
  primeNG: '${process.env.PRIMENG || ''}',
  domain: '${process.env.AUTH0_DOMAIN || ''}',
  clientId: '${process.env.AUTH0_CLIENT_ID || ''}',
};
`;

try {
  fs.writeFileSync(envProdPath, envConfigFile.trim() + '\n');
  console.log(`Berhasil membuat: ${envProdPath}`);

  fs.writeFileSync(envDefaultPath, envConfigFile.trim() + '\n');
  console.log(`Berhasil membuat: ${envDefaultPath}`);
} catch (err) {
  console.error('Gagal menulis file environment:', err);
  process.exit(1);
}
