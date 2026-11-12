'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { commitFixture, enforceFixtureScope } = require('./staff-migration-emulator-adapter');

const bank = () => ({ version: 1, revision: 4,
  users: [{ id: 'USR-X', email: 'x@milala.test', name: 'X', role: 'teller',
    branch: 'BR-DEMO', active: true, password: 'legacy-password' }],
  accounts: { one: { balance: 900 } }, audit: [{ id: 'KEEP' }],
  transactions: [{ id: 'TX-KEEP' }] });
const data = () => ({ milala_core_banking: bank(), milala_secure: { customerProfiles: { C: { active: true } } } });
const assignments = [{ staffId: 'USR-X', uid: 'uid-test', identity: {
  name: 'X', email: 'x@milala.test', role: 'teller', branch: 'BR-DEMO', active: true } }];

test('emulator CAS: updates UID, strips password, creates profile without touching banking records', () => {
  const before = data();
  const after = commitFixture(before, before.milala_core_banking, assignments);
  assert.equal(after.milala_core_banking.revision, 5);
  assert.equal(after.milala_core_banking.users[0].uid, 'uid-test');
  assert.equal('password' in after.milala_core_banking.users[0], false);
  assert.deepEqual(after.milala_secure.staffProfiles['uid-test'], {
    uid: 'uid-test', staffId: 'USR-X', name: 'X', email: 'x@milala.test',
    role: 'teller', branch: 'BR-DEMO', active: true });
  assert.deepEqual(after.milala_core_banking.accounts, before.milala_core_banking.accounts);
  assert.deepEqual(after.milala_core_banking.audit, before.milala_core_banking.audit);
  assert.deepEqual(after.milala_core_banking.transactions, before.milala_core_banking.transactions);
  assert.deepEqual(after.milala_secure.customerProfiles, before.milala_secure.customerProfiles);
  assert.equal(before.milala_core_banking.users[0].uid, undefined);
});

test('emulator CAS: rejects changed revision', () => {
  const state = data();
  const snapshot = structuredClone(state.milala_core_banking);
  state.milala_core_banking.revision += 1;
  assert.equal(commitFixture(state, snapshot, assignments), undefined);
});

test('emulator CAS: rejects changed staff not reflected by revision', () => {
  const state = data();
  const snapshot = structuredClone(state.milala_core_banking);
  state.milala_core_banking.users[0].role = 'admin';
  assert.equal(commitFixture(state, snapshot, assignments), undefined);
});

test('emulator CAS: rejects incompatible existing staff profile', () => {
  const state = data();
  state.milala_secure.staffProfiles = { 'uid-test': { staffId: 'OTHER' } };
  assert.equal(commitFixture(state, state.milala_core_banking, assignments), undefined);
});

test('emulator CAS: preserves object-keyed users', () => {
  const state = data();
  state.milala_core_banking.users = { 'staff-A': state.milala_core_banking.users[0] };
  const after = commitFixture(state, state.milala_core_banking, assignments);
  assert.deepEqual(Object.keys(after.milala_core_banking.users), ['staff-A']);
  assert.equal(after.milala_core_banking.users['staff-A'].uid, 'uid-test');
});

test('emulator adapter disallows non-fixture paths', () => {
  for (const candidate of ['/', '', 'milala_core_banking',
    '__milala_migration_integration__/a',
    '__milala_migration_integration__/foo/../../danger']) {
    assert.throws(() => enforceFixtureScope(candidate));
  }
});


test('initial progress lock accepts uncached undefined and rejects second claimant', async () => {
  const scope = '__milala_migration_integration__/1234567890abcdef';
  const keys = ['FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST',
    'GCLOUD_PROJECT', 'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_SERVICE_ACCOUNT_JSON'];
  const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9109';
    process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9010';
    process.env.GCLOUD_PROJECT = 'demo-milala-bank';
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    let stored; // undefined simulates a cold, uncached RTDB location.
    const db = { ref: () => ({
      on: (_event, callback) => callback({ exists: () => stored != null }),
      off: () => {},
      transaction: async updater => {
        const next = updater(stored);
        if (next === undefined) return { committed: false };
        stored = next;
        return { committed: true };
      }
    }) };
    const first = require('./staff-migration-emulator-adapter').createEmulatorAdapter({ db, auth: {}, scope });
    await first.writeProgress({ id: 'migration-1', status: 'preparing' });
    assert.equal(stored.status, 'preparing');
    await first.writeProgress({ id: 'migration-1', status: 'database-committed' });
    assert.equal(stored.status, 'database-committed');
    const second = require('./staff-migration-emulator-adapter').createEmulatorAdapter({ db, auth: {}, scope });
    await assert.rejects(second.writeProgress({ id: 'migration-2', status: 'preparing' }),
      /another migration or unreconciled marker/);
  } finally {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
});

// Regression for a real Firebase Emulator observation: `uid: null` in fixture
// is returned as an absent property (undefined). Conflict must not write uid.
test('regression: UID omitted on readback is not interpreted as a migration', () => {
  const state = data();
  state.milala_core_banking.users = {
    primary: { ...state.milala_core_banking.users[0], uid: null }
  };
  // Simulate database serialization of a null child as an absent property.
  const roundTrip = structuredClone(state);
  delete roundTrip.milala_core_banking.users.primary.uid;
  const beforeUsers = structuredClone(roundTrip.milala_core_banking.users);
  const expected = structuredClone(roundTrip.milala_core_banking);
  roundTrip.milala_core_banking.revision += 1;
  assert.equal(commitFixture(roundTrip, expected, assignments), undefined);
  assert.deepEqual(roundTrip.milala_core_banking.users, beforeUsers);
  assert.equal(Object.hasOwn(roundTrip.milala_core_banking.users.primary, 'uid'), false);
  assert.equal(Object.hasOwn(roundTrip.milala_core_banking.users.primary, 'password'), true);
});
