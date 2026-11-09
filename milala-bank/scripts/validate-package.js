'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

for (const file of ['firebase.json', '.firebaserc', 'database.rules.json', 'vercel.json', 'package.json']) {
  JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  console.log('JSON OK:', file);
}

for (const file of ['assets/js/app.js', 'assets/js/store.js', 'assets/js/seed.js', 'lib/banking.js', 'api/[action].js', 'scripts/migrate-staff.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${file}\n${result.stderr || result.stdout}`);
  console.log('Syntax OK:', file);
}

const rules = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8'));
if (rules.rules['.read'] !== false || rules.rules['.write'] !== false) {
  throw new Error('Realtime Database root rules must deny all client reads and writes.');
}
console.log('Security baseline OK: RTDB client access denied by default.');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!html.includes('firebase-auth-compat.js')) throw new Error('Firebase Auth SDK missing from index.html.');
if (html.includes('firebase-functions-compat.js')) throw new Error('Cloud Functions browser SDK should not be used in Spark/Vercel build.');
const store = fs.readFileSync(path.join(root, 'assets/js/store.js'), 'utf8');
if (!store.includes("fetch(`/api/")) throw new Error('Frontend is not routed to Vercel API.');
if (/firebase\.database\s*\(|localStorage|sessionStorage/.test(store)) throw new Error('Frontend must not access RTDB or browser storage directly.');
const backend = fs.readFileSync(path.join(root, 'lib/banking.js'), 'utf8');
if (backend.includes('firebase-functions')) throw new Error('Firebase Cloud Functions SDK must not be present.');
if (!backend.includes('FIREBASE_SERVICE_ACCOUNT_JSON')) throw new Error('Server-side Firebase credential environment variable missing.');
const route = fs.readFileSync(path.join(root, 'api/[action].js'), 'utf8');
if (!route.includes('verifyIdToken(match[1], true)')) throw new Error('Vercel API must verify Firebase ID tokens and revocation.');
console.log('Vercel/Firebase integration checks OK.');
