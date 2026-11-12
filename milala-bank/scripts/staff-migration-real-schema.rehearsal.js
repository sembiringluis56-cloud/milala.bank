'use strict';

// MILALA BANK V4: REAL-SCHEMA EMULATOR REHEARSAL, NEVER PRODUCTION.
// Reads the banking root + staff profiles from the secondary emulator,
// makes a minimal staff-only clone under a disposable fixture namespace,
// and calls the tested V3 migration coordinator against that fixture ONLY.
// Existing Auth users are READ ONLY. Newly created test users are disabled
// if migration fails, then deleted by the fixture cleanup.
// The original migrate-staff.js is neither imported nor edited.

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { migrate, preflight, plannedUid } = require('./staff-migration-core');
const { enforceEmulator, createEmulatorAdapter } = require('./staff-migration-emulator-adapter');

enforceEmulator(); // Must run before importing/initializing Firebase Admin.
const { initializeApp, getApps, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
assert.equal(getApps().length, 0, 'STOP: a Firebase Admin app is already initialized');

const app = initializeApp({
  projectId: 'demo-milala-bank',
  databaseURL: 'https://demo-milala-bank-default-rtdb.firebaseio.com'
});
const auth = getAuth(app);
const db = getDatabase(app);
const nonce = randomUUID().replace(/-/g, '');
const scope = '__milala_migration_integration__/' + nonce;
const dryRunOnly = !process.argv.includes('--rehearse');
let fixtureMade = false;
let cleanupUids = [];
let candidateNewUids = [];
let originalAuthUids = new Set();
let authBaselineCaptured = false;
let originalExistingStaff = new Map();
let initialMainBank;
let initialStaffProfiles;
let didComplete = false;

const clone = value => JSON.parse(JSON.stringify(value));
const stable = value => JSON.stringify(value);
const values = value => Array.isArray(value) ? value.filter(Boolean) :
  value && typeof value === 'object' ? Object.values(value).filter(Boolean) : [];

async function listAllUids() {
  const ids = [];
  let token;
  do {
    const batch = await auth.listUsers(1000, token);
    for (const user of batch.users) ids.push(user.uid);
    token = batch.pageToken;
  } while (token);
  return ids.sort();
}

async function getIfExists(uid) {
  try { return await auth.getUser(uid); }
  catch (error) { if (error.code === 'auth/user-not-found') return null; throw error; }
}

async function verifyMainUnchanged() {
  if (initialMainBank === undefined) return;
  assert.equal(stable((await db.ref('milala_core_banking').get()).val()),
    initialMainBank, 'STOP: main banking root changed during rehearsal');
  assert.equal(stable((await db.ref('milala_secure/staffProfiles').get()).val()),
    initialStaffProfiles, 'STOP: main staff profiles changed during rehearsal');
}

async function verifyExistingAuthUnchanged() {
  for (const [uid, before] of originalExistingStaff) {
    const now = await auth.getUser(uid);
    assert.equal(now.email, before.email, 'STOP: existing Auth email changed');
    assert.equal(now.disabled, before.disabled, 'STOP: existing Auth disabled status changed');
    assert.deepEqual(now.customClaims || {}, before.customClaims,
      'STOP: existing Auth claims changed');
  }
}

async function loadAndValidate() {
  const [rootSnap, profilesSnap, uidList] = await Promise.all([
    db.ref('milala_core_banking').get(),
    db.ref('milala_secure/staffProfiles').get(),
    listAllUids()
  ]);
  assert.ok(rootSnap.exists(), 'STOP: secondary emulator lacks the real banking root');
  const bank = rootSnap.val();
  assert.equal(bank.version, 1, 'STOP: unsupported source banking version');
  assert.ok(Number.isSafeInteger(bank.revision), 'STOP: invalid banking revision');
  const staff = values(bank.users);
  assert.ok(staff.length, 'STOP: secondary emulator has no staff records');
  initialMainBank = stable(bank);
  initialStaffProfiles = stable(profilesSnap.val());
  originalAuthUids = new Set(uidList);
  authBaselineCaptured = true;

  let linked = 0;
  let legacy = 0;
  const profiles = profilesSnap.val() || {};
  const relatedProfiles = {};
  for (const member of staff) {
    assert.ok(member && typeof member === 'object', 'STOP: invalid staff record');
    if (member.uid) {
      linked++;
      if (Object.hasOwn(profiles, member.uid)) {
        relatedProfiles[member.uid] = clone(profiles[member.uid]);
      }
      const original = await getIfExists(member.uid);
      if (original) originalExistingStaff.set(member.uid, {
        email: original.email, disabled: original.disabled,
        customClaims: clone(original.customClaims || {})
      });
    } else {
      legacy++;
      const reservedUid = plannedUid(member.id);
      // Never delete an Auth account that existed before this test.
      if (!originalAuthUids.has(reservedUid)) candidateNewUids.push({
        uid: reservedUid, email: String(member.email || '').toLowerCase()
      });
    }
    // The fixture adapter checks only within its scope. Check actual
    // emulator customer identities separately to avoid hiding collisions.
    const uidToCheck = member.uid || plannedUid(member.id);
    const collision = await db.ref('milala_secure/customerProfiles/' + uidToCheck).get();
    assert.ok(!collision.exists(), 'STOP: source staff UID collides with customer profile');
  }

  console.log(`DATA ASLI EMULATOR: ${staff.length} staf, ${linked} UID terhubung, ${legacy} UID belum ada`);
  console.log('SUMBER: /milala_core_banking/users + /milala_secure/staffProfiles (READ ONLY)');
  console.log('BANK UTAMA / AKUN AUTH LAMA: TIDAK AKAN DIUBAH');

  return {
    fixture: {
      milala_core_banking: {
        version: bank.version, revision: bank.revision, users: clone(bank.users),
        accounts: { canary: { unchanged: true } },
        transactions: { canary: { unchanged: true } },
        audit: { canary: { unchanged: true } }
      },
      milala_secure: {
        staffProfiles: relatedProfiles,
        customerProfiles: { canary: { unchanged: true } }
      }
    }, staff, linked, legacy
  };
}

async function cleanup() {
  let clean = true;
  // Only a UID not present before the test may be deleted, and only if
  // its email matches the staff identity copied into the test fixture.
  for (const item of cleanupUids) {
    try {
      const found = await getIfExists(item.uid);
      if (found && !originalAuthUids.has(item.uid)) {
        if (String(found.email || '').toLowerCase() !== item.email) {
          throw new Error('STOP: Auth UID contains a different email; refusing deletion');
        }
        await auth.deleteUser(item.uid);
      }
    } catch (error) {
      clean = false;
      console.error('CLEANUP AUTH GAGAL:', error.message);
    }
  }
  if (fixtureMade) {
    try { await db.ref(scope).remove(); }
    catch (error) { clean = false; console.error('CLEANUP FIXTURE GAGAL:', error.message); }
  }
  return clean;
}

async function run() {
  const data = await loadAndValidate();
  if (dryRunOnly) {
    console.log('MODE READ ONLY: fixture dan Auth baru TIDAK dibuat');
    console.log('UNTUK LATIHAN MIGRASI: jalankan ulang dengan --rehearse');
    return;
  }
  fixtureMade = true; // Set before the write: clean up even after a timed-out set.
  await db.ref(scope).set(data.fixture);
  const adapter = createEmulatorAdapter({ db, auth, scope });
  const create = adapter.createUser;
  adapter.createUser = async request => {
    const candidate = candidateNewUids.find(x => x.uid === request.uid);
    assert.ok(candidate && candidate.email === String(request.email || '').toLowerCase(),
      'STOP: unexpected Auth createUser request');
    // Record an attempted create before the network call. If it succeeds
    // remotely but the response times out, cleanup must still find the UID.
    cleanupUids.push(candidate);
    return create(request);
  };
  const plan = await preflight(adapter);
  assert.equal(plan.items.length, data.staff.length);
  console.log('PREFLIGHT DATA ASLI EMULATOR: LULUS');
  const result = await migrate(adapter);
  assert.equal(result.status, 'completed');
  const fixtureBank = (await db.ref(scope + '/milala_core_banking').get()).val();
  assert.equal(fixtureBank.revision, data.fixture.milala_core_banking.revision + 1);
  assert.deepEqual(fixtureBank.accounts, data.fixture.milala_core_banking.accounts);
  assert.deepEqual(fixtureBank.transactions, data.fixture.milala_core_banking.transactions);
  assert.deepEqual(fixtureBank.audit, data.fixture.milala_core_banking.audit);
  const progress = (await db.ref(scope + '/milala_secure/staffMigrationProgress').get()).val();
  assert.equal(progress.status, 'completed');
  didComplete = true;
  console.log('REHEARSAL DATA ASLI: BERHASIL DI FIXTURE TERPISAH');
}

(async () => {
  try { await run(); }
  catch (error) {
    process.exitCode = 1;
    console.error('REHEARSAL BELUM SIAP:', error.message);
    if (error.cause?.original) console.error('PENYEBAB AWAL:', error.cause.original.message);
    else if (error.cause?.message) console.error('PENYEBAB AWAL:', error.cause.message);
  } finally {
    if (!(await cleanup())) process.exitCode = 1;
    else console.log('PEMBERSIHAN FIXTURE DAN AKUN BARU: LULUS');
    try { await verifyMainUnchanged(); console.log('DATA BANK UTAMA: TETAP'); }
    catch (e) { process.exitCode = 1; console.error('PERINGATAN BANK:', e.message); }
    try { await verifyExistingAuthUnchanged(); console.log('AKUN STAF AUTH LAMA: TETAP'); }
    catch (e) { process.exitCode = 1; console.error('PERINGATAN AUTH:', e.message); }
    if (authBaselineCaptured) {
      try {
        const after = await listAllUids();
        assert.deepEqual(after, [...originalAuthUids].sort());
        console.log('DAFTAR UID AUTH AWAL: TETAP');
      } catch (e) { process.exitCode = 1; console.error('PERINGATAN DAFTAR UID:', e.message); }
    }
    await deleteApp(app);
    if (!process.exitCode && didComplete) console.log('REAL-SCHEMA EMULATOR REHEARSAL: LULUS');
    if (!process.exitCode && dryRunOnly) console.log('REAL-SCHEMA READ-ONLY CHECK: LULUS');
  }
})();
