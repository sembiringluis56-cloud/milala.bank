'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate, preflight, plannedUid } = require('./staff-migration-core');

const staff = id => ({ id, name: id, email: id.toLowerCase() + '@milala.test',
  role: 'teller', branch: 'BR-DEMO', active: true, password: 'demo-password-strong-' + id });

function mock({ failAt = null, linked = false, claimed = true, occupied = false, customer = false } = {}) {
  const events = [];
  const record = staff('USR-DEMO');
  if (linked) record.uid = 'uid-linked';
  const snapshot = { version: 1, revision: 9, users: [record], accounts: [{ id: 'ACC-KEEP' }] };
  let stored = null;
  const checks = {
    snapshot: async () => { events.push('snapshot'); return structuredClone(snapshot); },
    getUser: async uid => {
      if (linked && uid === 'uid-linked') return { uid, email: record.email,
        customClaims: { staff: true, role: claimed ? 'teller' : 'admin',
          staffId: 'USR-DEMO', branch: 'BR-DEMO' } };
      if (occupied && uid === plannedUid('USR-DEMO')) return { uid, email: record.email };
      return null;
    },
    getUserByEmail: async () => occupied ? { uid: 'customer-user' } : null,
    hasCustomerProfile: async () => customer,
    createUser: async data => {
      events.push('create:' + data.disabled);
      assert.equal(data.disabled, true);
      if (failAt === 'create') throw Error('simulated-create');
      return { uid: data.uid };
    },
    atomicCommit: async data => {
      events.push('commit');
      assert.equal(data.expected.revision, 9);
      assert.equal(data.assignments[0].uid, linked ? 'uid-linked' : plannedUid('USR-DEMO'));
      if (failAt === 'commit') throw Error('simulated-db-conflict');
    },
    setClaims: async () => { events.push('claims'); if (failAt === 'claims') throw Error('simulated-claims'); },
    enableUser: async () => { events.push('enable'); if (failAt === 'enable') throw Error('simulated-enable'); },
    disableUser: async () => { events.push('disable'); if (failAt === 'disable') throw Error('simulated-disable'); },
    writeProgress: async data => {
      events.push('progress:' + data.status);
      if (failAt === 'progress-complete' && data.status === 'completed') throw Error('simulated-progress');
      if (failAt === 'marker' && data.status === 'needs-reconciliation') throw Error('simulated-marker');
      stored = data;
    }
  };
  return { adapter: checks, events, progress: () => stored };
}

test('success: create disabled, CAS, claims, activate, complete', async () => {
  const x = mock();
  const result = await migrate(x.adapter);
  assert.equal(result.status, 'completed');
  assert.deepEqual(x.events.filter(s => !s.startsWith('snapshot')),
    ['progress:preparing','create:true','commit','progress:database-committed',
      'claims','enable','progress:completed']);
});

test('existing linked staff: no Auth modification', async () => {
  const x = mock({ linked: true });
  await migrate(x.adapter);
  assert.ok(!x.events.some(s => /^(create|claims|enable|disable)/.test(s)));
});

test('email takeover stops before writes', async () => {
  const x = mock({ occupied: true });
  await assert.rejects(preflight(x.adapter), /email already owned/);
  assert.ok(!x.events.some(s => s.startsWith('progress:')));
});

test('mismatched linked claims stop before writes', async () => {
  const x = mock({ linked: true, claimed: false });
  await assert.rejects(migrate(x.adapter), /conflicting claims/);
  assert.ok(!x.events.some(s => s.startsWith('progress:')));
});

test('customer profile collision stops before writes', async () => {
  const x = mock({ customer: true });
  await assert.rejects(migrate(x.adapter), /customer profile/);
  assert.ok(!x.events.some(s => s.startsWith('progress:')));
});

for (const failAt of ['create','commit','claims','enable','progress-complete']) {
  test('failure '+ failAt + ': disable and persist reconciliation', async () => {
    const x = mock({ failAt });
    await assert.rejects(migrate(x.adapter), /manual reconciliation/);
    assert.ok(x.events.includes('disable'));
    assert.equal(x.progress().status, 'needs-reconciliation');
    if (failAt === 'commit') assert.ok(!x.events.includes('claims'));
    if (failAt === 'claims') assert.ok(!x.events.includes('enable'));
  });
}

test('disable failure is surfaced and recorded (never silently swallowed)', async () => {
  const x = mock({ failAt: 'disable' });
  // Direct disable failure requires a second injected failure; adapt adapter accordingly.
  x.adapter.setClaims = async () => { throw Error('simulated-claims'); };
  await assert.rejects(async () => {
    try { await migrate(x.adapter); }
    catch (e) {
      assert.equal(e.disableFailures.length, 1);
      assert.equal(x.progress().disableFailures.length, 1);
      throw e;
    }
  }, /manual reconciliation/);
});

test('reconciliation marker failure becomes CRITICAL', async () => {
  const x = mock({ failAt: 'marker' });
  x.adapter.atomicCommit = async () => { throw Error('simulated-db-failure'); };
  await assert.rejects(migrate(x.adapter), /CRITICAL.*marker/);
});

console.log('Running offline staff migration core tests. No Firebase accessed.');


test('initial progress lock failure reports no migration started, not false CRITICAL', async () => {
  const x = mock();
  x.adapter.writeProgress = async data => {
    x.events.push('progress:' + data.status);
    throw Error('simulated-lock-denied');
  };
  await assert.rejects(migrate(x.adapter), /Migration did not start: simulated-lock-denied/);
  assert.ok(!x.events.some(s => /^(create|commit|disable|claims|enable)/.test(s)));
  assert.deepEqual(x.events.filter(s => s.startsWith('progress:')), ['progress:preparing']);
});
