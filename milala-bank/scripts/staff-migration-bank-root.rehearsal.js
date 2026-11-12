'use strict';

// DATABASE-ONLY rehearsal of the production-shaped root transaction against
// disposable paths in the SECONDARY emulator. No Auth users are created/updated.
// Does not import or modify migrate-staff.js. NEVER runs against production.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { enforceEmulator, enforceFixtureScope } = require('./staff-migration-emulator-adapter');
const { commitBankRoot, auditBankRoot } = require('./staff-migration-bank-root');

const clone = v => JSON.parse(JSON.stringify(v));
const equals = (a, b) => assert.deepEqual(a, b);
const usersList = users => Object.values(users || {}).filter(u => u && typeof u === 'object');

function buildFixture(bank, profiles, nonce) {
  assert.ok(bank && bank.version === 1 && Number.isSafeInteger(bank.revision),
    'STOP: missing/unsupported bank data');
  assert.ok(Array.isArray(bank.users) || (bank.users && typeof bank.users === 'object'),
    'STOP: missing bank staff');
  const original = usersList(bank.users);
  assert.ok(original.length > 0, 'STOP: no staff records in source');
  // This is a transaction-only rehearsal: it must not silently invent Auth
  // identities for real source staff that have not yet been linked.
  assert.ok(original.every(s => s.uid),
    'STOP: legacy source staff detected; use separate identity preflight');
  const id = '__v6-fixture-' + nonce.slice(0, 16);
  const uid = 'fixture-v6-' + nonce.slice(0, 24);
  const fake = {
    id, email: `v6-${nonce}@milala.invalid`,
    name: 'Fixture Only Staff', role: 'teller', branch: 'FIXTURE',
    active: false, password: 'NOT-A-REAL-PASSWORD-123456'
  };
  const nextUsers = clone(bank.users);
  if (Array.isArray(nextUsers)) nextUsers.push(fake);
  else {
    assert.ok(!Object.hasOwn(nextUsers, id), 'STOP: fixture key collision');
    nextUsers[id] = fake;
  }
  const bankFixture = {
    version: bank.version,
    revision: bank.revision,
    users: nextUsers,
    accounts: { canary: { balance: 33, unchanged: true } },
    transactions: { canary: { id: 'V6-T', unchanged: true } },
    journal: { canary: { id: 'V6-J', unchanged: true } },
    loans: { canary: { id: 'V6-L', unchanged: true } },
    audit: { canary: { id: 'V6-A', unchanged: true } }
  };
  const staffProfiles = {};
  for (const s of original) {
    if (profiles && Object.hasOwn(profiles, s.uid)) {
      staffProfiles[s.uid] = clone(profiles[s.uid]);
    }
  }
  const progressId = 'mig-v6-' + nonce.slice(0, 20);
  const owner = 'fixture-v6-owner-' + nonce.slice(0, 12);
  const fixture = {
    milala_core_banking: bankFixture,
    milala_secure: {
      staffProfiles,
      customerProfiles: { 'canary-customer': { unchanged: true } },
      staffMigrationProgress: { id: progressId, owner, status: 'preparing' }
    },
    another_app: { canary: true }
  };
  const assignments = usersList(nextUsers).map(s => ({
    staffId: s.id,
    uid: s.uid || uid,
    identity: { name: s.name || s.email, email: String(s.email).trim().toLowerCase(),
      role: s.role, branch: s.branch || null, active: s.active !== false }
  }));
  const expected = clone(bankFixture);
  return { fixture, expected, assignments, id: progressId, owner,
    staffCount: original.length, syntheticId: id, syntheticUid: uid };
}

// Keep the listener attached while the SDK's compare-and-swap settles, to
// avoid relying on an uncached transaction's first 'undefined' callback.
async function withLiveValue(ref, task) {
  let cb;
  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      cb = snapshot => {
        if (settled) return;
        settled = true;
        if (!snapshot.exists()) reject(Error('STOP: disposable fixture disappeared'));
        else resolve();
      };
      ref.on('value', cb, error => {
        if (!settled) { settled = true; reject(error); }
      });
    });
    return await task();
  } finally {
    if (cb) ref.off('value', cb);
  }
}

async function run() {
  enforceEmulator(); // MUST happen before firebase-admin module import.
  assert.equal(process.argv.length, 2, 'STOP: this rehearsal takes no arguments');
  const { initializeApp, getApps, deleteApp } = require('firebase-admin/app');
  const { getDatabase } = require('firebase-admin/database');
  assert.equal(getApps().length, 0, 'STOP: Firebase Admin app already initialized');
  const app = initializeApp({
    projectId: 'demo-milala-bank',
    databaseURL: 'https://demo-milala-bank-default-rtdb.firebaseio.com'
  });
  const db = getDatabase(app);
  const nonce = randomUUID().replace(/-/g, '');
  const scope = enforceFixtureScope('__milala_migration_integration__/' + nonce);
  const ref = db.ref(scope);
  let touchedFixture = false;
  let originalBank, originalProfiles;
  let worked = false;
  try {
    const [bankSnap, profileSnap] = await Promise.all([
      db.ref('milala_core_banking').get(),
      db.ref('milala_secure/staffProfiles').get()
    ]);
    originalBank = bankSnap.val();
    originalProfiles = profileSnap.val();
    const f = buildFixture(originalBank, originalProfiles, nonce);
    const before = clone(f.fixture);
    const info = auditBankRoot(before);
    assert.equal(info.legacyStaff, 1);
    console.log(`SUMBER EMULATOR: ${f.staffCount} staf terhubung; transaksi hanya di namespace sementara`);
    console.log('AUTH: TIDAK DIAKSES / TIDAK DIUBAH');

    touchedFixture = true; // cleanup even if set() times out after persisting.
    await ref.set(f.fixture);
    const outcome = await withLiveValue(ref, () => ref.transaction(
      current => commitBankRoot(current, f), undefined, false
    ));
    assert.equal(outcome.committed, true, 'STOP: fixture transaction did not commit');
    const after = (await ref.get()).val();
    assert.ok(after);
    assert.equal(after.milala_core_banking.revision, before.milala_core_banking.revision + 1);
    const upgraded = usersList(after.milala_core_banking.users).find(u => u.id === f.syntheticId);
    assert.ok(upgraded);
    assert.equal(upgraded.uid, f.syntheticUid);
    assert.equal(Object.hasOwn(upgraded, 'password'), false);
    assert.equal(after.milala_secure.staffProfiles[f.syntheticUid].staffId, f.syntheticId);
    for (const key of ['accounts', 'transactions', 'journal', 'loans', 'audit']) {
      equals(after.milala_core_banking[key], before.milala_core_banking[key]);
    }
    equals(after.milala_secure.customerProfiles, before.milala_secure.customerProfiles);
    equals(after.milala_secure.staffMigrationProgress, before.milala_secure.staffMigrationProgress);
    equals(after.another_app, before.another_app);
    console.log('TRANSAKSI ROOT-SHAPED: BERHASIL; REVISION +1, UID/PROFILE SINKRON');
    console.log('CANARY REKENING, TRANSAKSI, LOAN, AUDIT: TETAP');

    // Replay must be refused by server-side revision guard.
    const replayBefore = clone(after);
    const replay = await withLiveValue(ref, () => ref.transaction(
      current => commitBankRoot(current, f), undefined, false
    ));
    assert.equal(replay.committed, false, 'STOP: replay must abort');
    equals((await ref.get()).val(), replayBefore);
    console.log('REPLAY DENGAN REVISION LAMA: DITOLAK');

    // A concurrent revision increase must prevent an otherwise valid write.
    await ref.set(before);
    await ref.child('milala_core_banking/revision').set(before.milala_core_banking.revision + 1);
    const conflictBefore = (await ref.get()).val();
    const conflict = await withLiveValue(ref, () => ref.transaction(
      current => commitBankRoot(current, f), undefined, false
    ));
    assert.equal(conflict.committed, false, 'STOP: stale revision must abort');
    equals((await ref.get()).val(), conflictBefore);
    console.log('KONFLIK REVISION: DITOLAK TANPA PERUBAHAN');

    // A customer profile acquired after preflight must block staff UID commit.
    await ref.set(before);
    await ref.child('milala_secure/customerProfiles/' + f.syntheticUid).set({ active: true });
    const collisionBefore = (await ref.get()).val();
    const collision = await withLiveValue(ref, () => ref.transaction(
      current => commitBankRoot(current, f), undefined, false
    ));
    assert.equal(collision.committed, false, 'STOP: customer identity collision must abort');
    equals((await ref.get()).val(), collisionBefore);
    console.log('KONFLIK PROFIL NASABAH: DITOLAK TANPA PERUBAHAN');
    worked = true;
  } finally {
    let clean = true;
    if (touchedFixture) {
      try {
        await ref.remove();
        assert.equal((await ref.get()).exists(), false);
        console.log('PEMBERSIHAN FIXTURE: LULUS');
      } catch (e) { clean = false; console.error('STOP: pembersihan fixture gagal:', e.message); }
    }
    if (originalBank !== undefined) {
      try {
        equals((await db.ref('milala_core_banking').get()).val(), originalBank);
        equals((await db.ref('milala_secure/staffProfiles').get()).val(), originalProfiles);
        console.log('DATA BANK UTAMA DAN PROFIL ASLI: TIDAK BERUBAH');
      } catch (e) { clean = false; console.error('STOP: data utama berbeda:', e.message); }
    }
    await deleteApp(app);
    if (!clean) worked = false;
    if (!worked) process.exitCode = 1;
  }
  if (worked) console.log('INTEGRASI TRANSAKSI V6 EMULATOR: LULUS');
}

if (require.main === module) {
  run().catch(e => {
    console.error('INTEGRASI V6 GAGAL:', e.message);
    if (e.cause?.message) console.error('PENYEBAB:', e.cause.message);
    process.exitCode = 1;
  });
}
module.exports = { buildFixture, withLiveValue, run };
