const fs = require('fs');
const { argv } = require('yargs');

const targetFolder = './src/environments';
const targetPath = `${targetFolder}/environment.production.ts`;

if (!fs.existsSync(targetFolder)) {
  console.log(`Folder ${targetFolder} tidak ditemukan. Membuat folder baru...`);
  fs.mkdirSync(targetFolder, { recursive: true });
}

const envConfigFile = `
export const environment = {
  production: true,
  primeng:
    '${process.env.PRIMENG}',
  domain: '${process.env.AUTH0_DOMAIN}',
  clientId: '${process.env.AUTH0_CLIENT_ID}',
  clientSecret: '${process.env.AUTH0_CLIENT_SECRET}',
};
`;

fs.writeFile(targetPath, envConfigFile, function (err) {
  if (err) {
    console.error('Gagal membuat file environment:', err);
    throw err;
  } else {
    console.log(`Berhasil membuat file environment di ${targetPath}`);
  }
});
