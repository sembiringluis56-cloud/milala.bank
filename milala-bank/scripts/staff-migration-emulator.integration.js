'use strict';

// Disposable integration tests against SECOND emulator suite only: 9109/9010.
// Does not import or execute the original migrate-staff.js.
// Refuses all non-emulator configurations before Firebase initialization.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { migrate, plannedUid } = require('./staff-migration-core');
const { enforceEmulator, createEmulatorAdapter } = require('./staff-migration-emulator-adapter');

enforceEmulator();
const { initializeApp, getApps, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
assert.equal(getApps().length, 0, 'STOP: Firebase already initialized');

const app = initializeApp({ projectId: 'demo-milala-bank',
  databaseURL: 'https://demo-milala-bank-default-rtdb.firebaseio.com' });
const auth = getAuth(app);
const db = getDatabase(app);
const mainBank = db.ref('milala_core_banking');
const mainProfiles = db.ref('milala_secure/staffProfiles');

const stable = x => JSON.stringify(x); // read-only comparison; no concurrent operations expected
const generated = [];

function makeTest(label) {
  const nonce = randomUUID().replace(/-/g, '');
  const scope = '__milala_migration_integration__/' + nonce;
  const staffId = 'USR-INTEG-' + nonce.slice(0, 16).toUpperCase();
  const uid = plannedUid(staffId);
  const email = `integ-${nonce}@milala.test`;
  const password = randomBytes(24).toString('base64url');
  const record = { id: staffId, uid: null, name: `Test ${label}`,
    email, password, role: 'teller', branch: 'BR-DEMO', active: true };
  const fixture = { milala_core_banking: { version: 1, revision: 3,
    users: { primary: record }, accounts: { untouched: { balance: 345 } },
    audit: [{ id: 'AUDIT-KEEP' }], transactions: [{ id: 'TX-KEEP' }] },
    milala_secure: { customerProfiles: { untouched: { active: true } } } };
  return { scope, staffId, uid, email, fixture };
}

async function setup(label) {
  const test = makeTest(label);
  generated.push(test);
  assert.equal((await auth.getUserByEmail(test.email).catch(e => {
    if (e.code === 'auth/user-not-found') return null;
    throw e;
  })), null);
  await db.ref(test.scope).set(test.fixture);
  return test;
}

async function validateUnrelated(test) {
  const bank = (await db.ref(test.scope + '/milala_core_banking').get()).val();
  assert.deepEqual(bank.accounts, test.fixture.milala_core_banking.accounts);
  assert.deepEqual(bank.transactions, test.fixture.milala_core_banking.transactions);
  assert.deepEqual(bank.audit, test.fixture.milala_core_banking.audit);
  const customer = (await db.ref(test.scope + '/milala_secure/customerProfiles').get()).val();
  assert.deepEqual(customer, test.fixture.milala_secure.customerProfiles);
}

async function success() {
  const t = await setup('success');
  const adapter = createEmulatorAdapter({ db, auth, scope: t.scope });
  const result = await migrate(adapter);
  assert.equal(result.status, 'completed');
  const user = await auth.getUser(t.uid);
  assert.equal(user.email, t.email);
  assert.equal(user.disabled, false);
  assert.equal(user.customClaims?.staffId, t.staffId);
  assert.equal(user.customClaims?.role, 'teller');
  const bank = (await db.ref(t.scope + '/milala_core_banking').get()).val();
  assert.equal(bank.revision, 4);
  assert.equal(bank.users.primary.uid, t.uid);
  assert.equal(Object.prototype.hasOwnProperty.call(bank.users.primary, 'password'), false);
  const progress = (await db.ref(t.scope + '/milala_secure/staffMigrationProgress').get()).val();
  assert.equal(progress.status, 'completed');
  await validateUnrelated(t);
  console.log('INTEGRASI SUKSES: database, Auth, claims, profile, progress sinkron');
}

async function failedClaims() {
  const t = await setup('claims-failure');
  const adapter = createEmulatorAdapter({ db, auth, scope: t.scope });
  adapter.setClaims = async () => { throw Error('SIMULATED_CLAIMS_ERROR'); };
  await assert.rejects(migrate(adapter), /manual reconciliation required/);
  const user = await auth.getUser(t.uid);
  assert.equal(user.disabled, true);
  const progress = (await db.ref(t.scope + '/milala_secure/staffMigrationProgress').get()).val();
  assert.equal(progress.status, 'needs-reconciliation');
  assert.equal(progress.failedPhase, 'database-committed');
  await validateUnrelated(t);
  console.log('INTEGRASI GAGAL CLAIMS: akun nonaktif + marker rekonsiliasi');
}

async function failedConflict() {
  const t = await setup('revision-conflict');
  // Read the actual RTDB representation before injecting a concurrent write.
  // RTDB omits null properties: a fixture with uid:null reads back without uid.
  const usersBefore = (await db.ref(t.scope + '/milala_core_banking/users').get()).val();
  const adapter = createEmulatorAdapter({ db, auth, scope: t.scope });
  const commit = adapter.atomicCommit;
  adapter.atomicCommit = async request => {
    await db.ref(t.scope + '/milala_core_banking/revision').set(4);
    return commit(request);
  };
  await assert.rejects(migrate(adapter), /manual reconciliation required/);
  const user = await auth.getUser(t.uid);
  assert.equal(user.disabled, true);
  const bank = (await db.ref(t.scope + '/milala_core_banking').get()).val();
  assert.equal(bank.revision, 4);
  // The conflict must not modify ANY staff record. Compare actual RTDB
  // readbacks instead of assuming a null key survives serialization.
  assert.deepEqual(bank.users, usersBefore,
    'CAS revision conflict must leave staff records unchanged');
  assert.equal(Object.hasOwn(bank.users.primary, 'uid'), false);
  assert.ok(Object.prototype.hasOwnProperty.call(bank.users.primary, 'password'));
  assert.equal((await db.ref(t.scope + '/milala_secure/staffMigrationProgress').get()).val().status,
    'needs-reconciliation');
  await validateUnrelated(t);
  console.log('INTEGRASI KONFLIK REVISION: CAS ditolak, akun nonaktif + marker');
}

async function main() {
  const [beforeBank, beforeProfiles, beforeAccounts] = await Promise.all([
    mainBank.get(), mainProfiles.get(), auth.listUsers(1000)
  ]);
  assert.ok(beforeBank.exists(), 'STOP: main banking root missing in second emulator');
  const mainBankBefore = stable(beforeBank.val());
  const mainProfilesBefore = stable(beforeProfiles.val());
  const originalUids = beforeAccounts.users.map(x => x.uid).sort();
  console.log('EMULATOR SALINAN: 9109/9010, namespace uji terpisah');
  await success();
  await failedClaims();
  await failedConflict();
  assert.equal(stable((await mainBank.get()).val()), mainBankBefore,
    'STOP: main banking root was modified');
  assert.equal(stable((await mainProfiles.get()).val()), mainProfilesBefore,
    'STOP: main staff profiles were modified');
  console.log('DATA BANK UTAMA DI EMULATOR SALINAN: TIDAK BERUBAH');
  // Auth account check occurs after cleanup in finally.
  return originalUids;
}

async function cleanup() {
  let okay = true;
  for (const t of generated) {
    try {
      const record = await auth.getUser(t.uid).catch(e => {
        if (e.code === 'auth/user-not-found') return null;
        throw e;
      });
      if (record) {
        if (record.email !== t.email) {
          throw Error('STOP: unexpected account at disposable UID');
        }
        await auth.deleteUser(t.uid);
      }
    } catch (error) {
      okay = false;
      console.error('CLEANUP AUTH FAILED for', t.uid, error.message);
    }
    try { await db.ref(t.scope).remove(); }
    catch (error) { okay = false; console.error('CLEANUP FIXTURE FAILED:', t.scope, error.message); }
  }
  if (okay) console.log('PEMBERSIHAN AKUN DAN FIXTURE UJI: LULUS');
  return okay;
}

(async () => {
  let initialUids;
  try {
    initialUids = await main();
  } catch (error) {
    console.error('INTEGRASI GAGAL:', error.message);
    // The coordinator attaches original and marker errors to cause.
    // Print messages only (no tokens, passwords or credentials).
    const cause = error.cause;
    if (cause?.original) console.error('PENYEBAB AWAL:', cause.original.message);
    else if (cause?.message) console.error('PENYEBAB AWAL:', cause.message);
    if (cause?.marker) console.error('PENYEBAB MARKER:', cause.marker.message);
    if (cause?.disableFailures?.length) {
      console.error('KEGAGALAN NONAKTIFKAN:', cause.disableFailures.map(x => x.uid));
    }
    process.exitCode = 1;
  } finally {
    if (!(await cleanup())) process.exitCode = 1;
    if (initialUids) {
      try {
        const after = (await auth.listUsers(1000)).users.map(x => x.uid).sort();
        assert.deepEqual(after, initialUids);
        console.log('AUTH EMULATOR: JUMLAH DAN UID AKUN AWAL TETAP');
      } catch (error) {
        process.exitCode = 1;
        console.error('FINAL AUTH CHECK FAILED:', error.message);
      }
    }
    await deleteApp(app);
    if (!process.exitCode) console.log('INTEGRASI EMULATOR: LULUS');
  }
})();
