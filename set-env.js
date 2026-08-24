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
  primeNG: '${process.env.PRIMENG}',
  domain: '${process.env.AUTH0_DOMAIN}',
  clientId: '${process.env.AUTH0_CLIENT_ID}',
  clientSecret: '${process.env.AUTH0_CLIENT_SECRET}',

  DATABASE_URL: '${process.env.DATABASE_URL}',
  DATABASE_URL_UNPOOLED: '${process.env.DATABASE_URL_UNPOOLED}',

  PGHOST: '${process.env.PGHOST}',
  PGHOST_UNPOOLED: '${process.env.PGHOST_UNPOOLED}',
  PGUSER: '${process.env.PGUSER}',
  PGDATABASE: '${process.env.PGDATABASE}',
  PGPASSWORD: '${process.env.PGPASSWORD}',

  POSTGRES_URL: '${process.env.POSTGRES_URL}',
  POSTGRES_URL_NON_POOLING: '${process.env.POSTGRES_URL_NON_POOLING}',
  POSTGRES_USER: '${process.env.POSTGRES_USER}',
  POSTGRES_HOST: '${process.env.POSTGRES_HOST}',
  POSTGRES_PASSWORD: '${process.env.POSTGRES_PASSWORD}',
  POSTGRES_DATABASE: '${process.env.POSTGRES_DATABASE}',
  POSTGRES_URL_NO_SSL: '${process.env.POSTGRES_URL_NO_SSL}',
  POSTGRES_PRISMA_URL: '${process.env.POSTGRES_PRISMA_URL}',

};
`;

try {
  fs.writeFileSync(envProdPath, envConfigFile);
  console.log(`Berhasil membuat: ${envProdPath}`);

  fs.writeFileSync(envDefaultPath, envConfigFile);
  console.log(`Berhasil membuat: ${envDefaultPath}`);
} catch (err) {
  console.error('Gagal menulis file environment:', err);
  process.exit(1);
}
