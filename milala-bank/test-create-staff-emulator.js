'use strict';

// Tes CREATE_STAFF di Firebase Emulator. Tidak mengubah file lib/banking.js.
// PENTING: jangan jalankan tanpa kedua emulator lokal aktif.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { getApps, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

const expectedEnvironment = {
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000',
  GCLOUD_PROJECT: 'demo-milala-bank'
};

for (const [key, value] of Object.entries(expectedEnvironment)) {
  if (process.env[key] !== value) {
    throw new Error(`STOP: ${key} harus ${value}. Emulator tidak sesuai.`);
  }
}

if (getApps().length) {
  throw new Error('STOP: Firebase sudah diinisialisasi sebelum pengujian.');
}

const filename = path.resolve(__dirname, 'lib/banking.js');
const source = fs.readFileSync(filename, 'utf8');
const startMarker = 'const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;';
const endMarker = 'const db = () => getDatabase();';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);

if (start < 0 || end <= start) {
  throw new Error('STOP: Struktur bootstrap lib/banking.js tidak dikenali.');
}

// Ganti hanya bootstrap Firebase dalam memori. Sumber di disk tidak diubah.
const emulatorBootstrap = `
if (!getApps().length) {
  initializeApp({
    projectId: 'demo-milala-bank',
    databaseURL: 'https://demo-milala-bank-default-rtdb.firebaseio.com'
  });
}
`;

const testSource = source.slice(0, start) + emulatorBootstrap + source.slice(end);
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(testSource, filename);

async function main() {
  const auth = getAuth();
  const db = getDatabase();
  const root = db.ref('milala_core_banking');
  const adminProfileRef = db.ref('milala_secure/staffProfiles/demo-admin-001');

  const [admin, rootSnapshot, adminProfileSnapshot, authUsers] = await Promise.all([
    auth.getUser('demo-admin-001'),
    root.get(),
    adminProfileRef.get(),
    auth.listUsers(100)
  ]);

  assert.equal(admin.disabled, false, 'Admin demo harus aktif');
  assert.equal(admin.customClaims?.role, 'admin');
  assert.equal(admin.customClaims?.staffId, 'USR-DEMO-ADMIN');
  assert.equal(adminProfileSnapshot.val()?.active, true);
  assert.equal(adminProfileSnapshot.val()?.role, 'admin');
  assert.equal(adminProfileSnapshot.val()?.staffId, 'USR-DEMO-ADMIN');
  assert.equal(rootSnapshot.val()?.branches?.[0]?.id, 'BR-DEMO');

  // Jika pengujian sebelumnya meninggalkan data parsial, hentikan tanpa perubahan.
  const existingStaff = Object.values(rootSnapshot.val()?.users || {});
  if (authUsers.users.length !== 1 || existingStaff.length !== 1) {
    throw new Error(
      `STOP: Emulator tidak bersih (akun Auth=${authUsers.users.length}, staf root=${existingStaff.length}). ` +
      'Periksa data demo sebelum mengulang tes.'
    );
  }

  console.log('VALIDASI ADMIN DEMO: LULUS');
  console.log('Menguji CREATE_STAFF di emulator...');

  const email = `teller-${randomUUID().slice(0, 8)}@milala.test`;
  const result = await loaded.exports.manageStaffAccount({
    auth: {
      uid: 'demo-admin-001',
      token: {
        staff: true,
        role: 'admin',
        staffId: 'USR-DEMO-ADMIN',
        branch: 'BR-DEMO',
        email: 'admin@milala.test'
      }
    },
    data: {
      name: 'Teller Simulasi',
      email,
      role: 'teller',
      branch: 'BR-DEMO',
      active: true,
      password: randomBytes(24).toString('base64url')
    }
  });

  const user = await auth.getUserByEmail(email);
  const staffProfile = (
    await db.ref(`milala_secure/staffProfiles/${user.uid}`).get()
  ).val();
  const updatedState = (await root.get()).val();
  const staff = Object.values(updatedState?.users || {}).find(
    (item) => item && item.uid === user.uid
  );

  assert.ok(staff, 'Staf baru tidak ditemukan di root database');
  assert.ok(staffProfile, 'Profil staf baru tidak ditemukan');
  assert.equal(staff.id, staffProfile.staffId);
  assert.equal(user.customClaims?.staffId, staff.id);
  assert.equal(user.customClaims?.role, 'teller');
  assert.equal(staffProfile.role, 'teller');
  assert.equal(staffProfile.active, true);
  assert.equal(user.disabled, false);
  assert.ok(result?.state, 'Fungsi tidak mengembalikan state');

  console.log('CREATE_STAFF: BERHASIL');
  console.log('Email:', email);
  console.log('Staff ID:', staff.id);
  console.log('Auth, Claims, Root dan Profile: SINKRON');
}

main()
  .catch((error) => {
    console.error('PENGUJIAN GAGAL:', {
      code: error?.code || 'unknown',
      message: error?.message || String(error)
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const app of getApps()) {
      await deleteApp(app);
    }
  });
