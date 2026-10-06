// Generates a self-signed HTTPS certificate for LAN deployment into certs/.
// SAN includes localhost + every current LAN IPv4, so browsers treat the
// origin consistently after trusting the cert. Usage: npm run gen-cert
import forge from 'node-forge';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CERT_DIR = path.join(ROOT, 'certs');
fs.mkdirSync(CERT_DIR, { recursive: true });

const ips = ['127.0.0.1'];
for (const list of Object.values(os.networkInterfaces())) {
  for (const it of list || []) {
    if (it.family === 'IPv4' && !it.internal && !ips.includes(it.address)) ips.push(it.address);
  }
}

const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01' + Date.now().toString(16);
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000); // 10 years

const attrs = [{ name: 'commonName', value: 'WemuStation' }];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.setExtensions([
  { name: 'basicConstraints', cA: true },
  { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true },
  {
    name: 'subjectAltName',
    altNames: [
      { type: 2, value: 'localhost' },
      ...ips.map((ip) => ({ type: 7, ip }))
    ]
  }
]);

cert.sign(keys.privateKey, forge.md.sha256.create());

fs.writeFileSync(path.join(CERT_DIR, 'key.pem'), forge.pki.privateKeyToPem(keys.privateKey));
fs.writeFileSync(path.join(CERT_DIR, 'cert.pem'), forge.pki.certificateToPem(cert));
console.log('certificate written to certs/ (valid 10 years)');
console.log('SAN covers:', ['localhost', ...ips].join(', '));
console.log('restart the server to enable HTTPS');
