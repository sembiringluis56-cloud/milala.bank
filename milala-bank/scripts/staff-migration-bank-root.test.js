'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { commitBankRoot, auditBankRoot } = require('./staff-migration-bank-root');
const clone = x => JSON.parse(JSON.stringify(x));

function fixture() {
  const user = { id: 'S1', name: 'Staff One', email: 'staff1@milala.test', role: 'teller',
    branch: 'BR-1', active: true, password: 'legacy_password_123456' };
  const root = {
    milala_core_banking: { version: 1, revision: 14, users: { p01: user },
      accounts: { acc: { balance: 300 } }, transactions: [{ id: 'T1' }],
      journal: [{ id: 'J1' }], audit: [{ id: 'A1' }], loans: [{ id: 'L1' }] },
    milala_secure: { staffProfiles: {}, customerProfiles: { customer: { active: true } },
      staffMigrationProgress: { id: 'M1', owner: 'O1', status: 'preparing' } },
    another_app: { leave: 'untouched' }
  };
  const expected = clone(root.milala_core_banking);
  const assignments = [{ staffId: 'S1', uid: 'uid-new-s1', identity: {
    name: user.name, email: user.email, role: user.role,
    branch: user.branch, active: true } }];
  return {root, expected, assignments, id:'M1', owner:'O1'};
}
const apply = f => commitBankRoot(f.root, f);

test('real-shaped root: one atomic users + profiles + revision commit; unrelated data preserved', () => {
  const f=fixture(); const before=clone(f.root); const next=apply(f);
  assert.ok(next); assert.equal(next.milala_core_banking.revision,15);
  assert.equal(next.milala_core_banking.users.p01.uid,'uid-new-s1');
  assert.equal(Object.hasOwn(next.milala_core_banking.users.p01,'password'),false);
  assert.equal(next.milala_secure.staffProfiles['uid-new-s1'].staffId,'S1');
  assert.deepEqual(next.milala_core_banking.accounts,before.milala_core_banking.accounts);
  assert.deepEqual(next.milala_core_banking.transactions,before.milala_core_banking.transactions);
  assert.deepEqual(next.milala_core_banking.journal,before.milala_core_banking.journal);
  assert.deepEqual(next.milala_core_banking.audit,before.milala_core_banking.audit);
  assert.deepEqual(next.milala_core_banking.loans,before.milala_core_banking.loans);
  assert.deepEqual(next.milala_secure.customerProfiles,before.milala_secure.customerProfiles);
  assert.deepEqual(next.milala_secure.staffMigrationProgress,before.milala_secure.staffMigrationProgress);
  assert.deepEqual(next.another_app,before.another_app);
  assert.deepEqual(f.root,before,'transaction updater must not mutate the original input');
});
test('revision changed: abort without mutation', () => {
  const f=fixture(); f.root.milala_core_banking.revision++; const before=clone(f.root);
  assert.equal(apply(f),undefined); assert.deepEqual(f.root,before);
});
test('staff changed even without revision increase: abort', () => {
  const f=fixture(); f.root.milala_core_banking.users.p01.email='other@milala.test';
  assert.equal(apply(f),undefined);
});
test('owner mismatch: abort', () => {
  const f=fixture(); f.root.milala_secure.staffMigrationProgress.owner='OTHER';
  assert.equal(apply(f),undefined);
});
test('reconciliation marker: abort', () => {
  const f=fixture(); f.root.milala_secure.staffMigrationProgress.status='needs-reconciliation';
  assert.equal(apply(f),undefined);
});
test('customer profile acquired after preflight: abort', () => {
  const f=fixture(); f.root.milala_secure.customerProfiles['uid-new-s1']={owner:'customer'};
  assert.equal(apply(f),undefined);
});
test('another staff profile claims target UID: abort', () => {
  const f=fixture(); f.root.milala_secure.staffProfiles['uid-new-s1']={staffId:'OTHER'};
  assert.equal(apply(f),undefined);
});
test('second commit/replay with stale revision: abort', () => {
  const f=fixture(); f.root=apply(f); assert.equal(apply(f),undefined);
});
test('malformed UID or empty scope: abort', () => {
  const f=fixture(); f.assignments[0].uid='customer/path';
  assert.equal(apply(f),undefined);
  const g=fixture(); g.owner=''; assert.equal(apply(g),undefined);
});
test('audit: linked staff + state of incomplete migration is visible', () => {
  const f=fixture(); f.root.milala_secure.staffMigrationProgress.status='needs-reconciliation';
  const info=auditBankRoot(f.root);
  assert.equal(info.staffCount,1); assert.equal(info.legacyStaff,1);
  assert.equal(info.linkedStaff,0); assert.equal(info.revision,14);
  assert.equal(info.requiresReconciliation,true);
  assert.equal(info.migrationStatus,'needs-reconciliation');
});
test('audit: fully linked real-shape root indicates no legacy UID work', () => {
  const f=fixture(); f.root.milala_core_banking.users.p01.uid='uid-linked';
  delete f.root.milala_secure.staffMigrationProgress;
  const info=auditBankRoot(f.root);
  assert.equal(info.legacyStaff,0); assert.equal(info.linkedStaff,1);
  assert.equal(info.requiresReconciliation,false);
});
