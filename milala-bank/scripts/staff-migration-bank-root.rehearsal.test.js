'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFixture } = require('./staff-migration-bank-root.rehearsal');
const { commitBankRoot } = require('./staff-migration-bank-root');
const clone = x => JSON.parse(JSON.stringify(x));
const nonce = '0123456789abcdef0123456789abcdef';
const staff = { id:'S1', uid:'existing-uid', name:'Existing', email:'e@milala.test',
  role:'teller', active:true, branch:'X' };
const bank = () => ({ version:1, revision:14, users: { s1: clone(staff) } });
const profile = () => ({ 'existing-uid': { uid:'existing-uid', staffId:'S1', name:'Existing',
  email:'e@milala.test', role:'teller', branch:'X', active:true } });

test('builds a disposable root-shaped fixture with original linked staff and one fake legacy staff', () => {
  const source=bank(); const original=clone(source);
  const f=buildFixture(source, profile(), nonce);
  assert.deepEqual(source, original);
  assert.equal(f.staffCount,1);
  assert.equal(f.assignments.length,2);
  assert.equal(f.fixture.milala_core_banking.users.s1.uid,'existing-uid');
  assert.equal(Object.hasOwn(f.fixture.milala_core_banking.users[f.syntheticId], 'uid'),false);
  assert.equal(f.fixture.milala_secure.staffProfiles['existing-uid'].staffId,'S1');
});
test('real root updater commits fixture and preserves existing linked staff', () => {
  const f=buildFixture(bank(),profile(),nonce);
  const after=commitBankRoot(f.fixture,f);
  assert.ok(after);
  assert.equal(after.milala_core_banking.users.s1.uid,'existing-uid');
  assert.equal(after.milala_core_banking.users[f.syntheticId].uid,f.syntheticUid);
  assert.equal(Object.hasOwn(after.milala_core_banking.users[f.syntheticId],'password'),false);
  assert.equal(after.milala_core_banking.revision,15);
});
test('replaying same transaction rejects stale revision', () => {
  const f=buildFixture(bank(),profile(),nonce);
  const after=commitBankRoot(f.fixture,f);
  assert.equal(commitBankRoot(after,f),undefined);
});
test('rejects changed staff identity even if revision remains unchanged', () => {
  const f=buildFixture(bank(),profile(),nonce);
  f.fixture.milala_core_banking.users.s1.email='changed@milala.test';
  assert.equal(commitBankRoot(f.fixture,f),undefined);
});
test('rejects customer profile acquisition after preflight', () => {
  const f=buildFixture(bank(),profile(),nonce);
  f.fixture.milala_secure.customerProfiles[f.syntheticUid]={owner:'customer'};
  assert.equal(commitBankRoot(f.fixture,f),undefined);
});
test('rejects linked source staff without UID instead of inventing Auth identities', () => {
  const b=bank(); delete b.users.s1.uid;
  assert.throws(() => buildFixture(b,profile(),nonce),/legacy source staff detected/);
});
test('preserves array-keyed staff collection', () => {
  const b=bank(); b.users=[clone(staff)];
  const f=buildFixture(b,profile(),nonce);
  const after=commitBankRoot(f.fixture,f);
  assert.ok(after);
  assert.equal(after.milala_core_banking.users[0].uid,'existing-uid');
  assert.equal(after.milala_core_banking.users[1].uid,f.syntheticUid);
});
