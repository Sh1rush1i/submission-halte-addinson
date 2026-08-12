const fs = require('fs');
const { argv } = require('yargs');

const targetPath = './src/environments/environment.production.ts';

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
    console.error(err);
    throw err;
  } else {
    console.log(`Berhasil membuat file environment di ${targetPath}`);
  }
});
