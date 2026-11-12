'use strict';

// Intentionally restricted to disposable emulator fixtures.
// NEVER use this adapter for a real Firebase database/project.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const PREFIX = '__milala_migration_integration__/';
const clone = x => JSON.parse(JSON.stringify(x));
const email = x => String(x || '').trim().toLowerCase();
const records = value => Array.isArray(value) ? value.filter(Boolean) :
  value && typeof value === 'object' ? Object.values(value).filter(Boolean) : [];

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function enforceFixtureScope(scope) {
  if (typeof scope !== 'string' ||
      !/^__milala_migration_integration__\/[a-zA-Z0-9_-]{12,80}$/.test(scope)) {
    throw Error('STOP: adapter requires a unique disposable emulator fixture scope');
  }
  return scope;
}

function enforceEmulator() {
  const expected = {
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9109',
    FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9010',
    GCLOUD_PROJECT: 'demo-milala-bank'
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(process.env[key], value, 'STOP: unexpected ' + key);
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw Error('STOP: production credentials must not be set');
  }
}

// Pure atomic transaction updater. Returns undefined when CAS must abort.
// Changes ONLY the users, profiles and revision within the current scope,
// preserving sibling banking data/keys and other secure data.
function commitFixture(current, expected, assignments) {
  if (!current || typeof current !== 'object' ||
      !current.milala_core_banking || !expected ||
      !Array.isArray(assignments)) return;
  const banking = current.milala_core_banking;
  if (Number(banking.version) !== 1 ||
      banking.revision !== expected.revision ||
      stable(banking.users) !== stable(expected.users)) return;

  const currentStaff = records(banking.users);
  if (currentStaff.length !== assignments.length ||
      new Set(assignments.map(x => x.staffId)).size !== assignments.length ||
      new Set(assignments.map(x => x.uid)).size !== assignments.length) return;

  const next = clone(current);
  const users = next.milala_core_banking.users;
  if (!Array.isArray(users) && (!users || typeof users !== 'object')) return;
  next.milala_secure = next.milala_secure || {};
  next.milala_secure.staffProfiles = next.milala_secure.staffProfiles || {};
  const profiles = next.milala_secure.staffProfiles;

  for (const assignment of assignments) {
    if (!assignment || !assignment.uid || !assignment.identity) return;
    const matches = Object.entries(users).filter(([_, u]) => u && u.id === assignment.staffId);
    if (matches.length !== 1) return;
    const [key, user] = matches[0];
    const identity = assignment.identity;
    if (email(user.email) !== identity.email ||
        String(user.name || user.email) !== identity.name ||
        user.role !== identity.role ||
        (user.branch || null) !== identity.branch ||
        (user.active !== false) !== identity.active ||
        (user.uid && user.uid !== assignment.uid)) return;

    const profile = { uid: assignment.uid, staffId: assignment.staffId,
      name: identity.name, email: identity.email, role: identity.role,
      branch: identity.branch, active: identity.active };
    if (profiles[assignment.uid] && stable(profiles[assignment.uid]) !== stable(profile)) return;
    user.uid = assignment.uid;
    delete user.password;
    profiles[assignment.uid] = profile;
  }
  next.milala_core_banking.revision += 1;
  return next;
}

// Keep the listener live UNTIL the transaction settles. The RTDB SDK can
// initially invoke transaction updaters with undefined for an uncached path.
async function withLiveValue(ref, task, requireExisting = false) {
  let callback;
  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      callback = snap => {
        if (settled) return;
        settled = true;
        if (requireExisting && !snap.exists()) {
          reject(Error('STOP: fixture missing before transaction'));
        } else {
          resolve();
        }
      };
      ref.on('value', callback, error => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
    });
    return await task();
  } finally {
    if (callback) ref.off('value', callback);
  }
}

function createEmulatorAdapter({ db, auth, scope }) {
  enforceEmulator();
  enforceFixtureScope(scope);
  if (!db || !auth) throw Error('STOP: Firebase emulator instances required');
  const prefix = `${scope}/`;
  const fixtureRef = db.ref(scope);
  const migrationRef = db.ref(prefix + 'milala_secure/staffMigrationProgress');
  const owner = randomUUID();
  let claimed = false;

  const lookup = async (fn) => {
    try { return await fn(); }
    catch (error) { if (error.code === 'auth/user-not-found') return null; throw error; }
  };

  async function progress(data) {
    if (!data || !data.id || !data.status) throw Error('Invalid migration progress');
    if (data.status === 'preparing') {
      const result = await withLiveValue(migrationRef, () =>
        migrationRef.transaction(current => {
          // Both null (loaded empty) and undefined (uncached empty) are vacant.
          // Transaction server-side CAS retries if a competing writer claims it.
          if (current != null) return;
          return { ...data, owner, updatedAt: new Date().toISOString() };
        }, undefined, false)
      );
      if (!result.committed) throw Error('STOP: another migration or unreconciled marker exists');
      claimed = true;
      return;
    }
    if (!claimed) throw Error('STOP: migration progress not owned by this process');
    const result = await withLiveValue(migrationRef, () =>
      migrationRef.transaction(current => {
        if (!current || current.owner !== owner || current.id !== data.id ||
            current.status === 'completed') return;
        return { ...current, ...data, owner, updatedAt: new Date().toISOString() };
      }, undefined, false)
    );
    if (!result.committed) throw Error('STOP: could not advance migration marker');
  }

  return {
    snapshot: async () => (await db.ref(prefix + 'milala_core_banking').get()).val(),
    getUser: uid => lookup(() => auth.getUser(uid)),
    getUserByEmail: addr => lookup(() => auth.getUserByEmail(addr)),
    hasCustomerProfile: async uid =>
      (await db.ref(prefix + 'milala_secure/customerProfiles/' + uid).get()).exists(),
    createUser: data => auth.createUser(data),
    setClaims: (uid, claims) => auth.setCustomUserClaims(uid, claims),
    enableUser: uid => auth.updateUser(uid, { disabled: false }),
    disableUser: uid => auth.updateUser(uid, { disabled: true }),
    writeProgress: progress,
    atomicCommit: async ({ id, expected, assignments }) => {
      if (!claimed) throw Error('STOP: migration lock missing');
      const marker = (await migrationRef.get()).val();
      if (!marker || marker.owner !== owner || marker.id !== id ||
          marker.status !== 'preparing') {
        throw Error('STOP: migration lock invalid');
      }
      const outcome = await withLiveValue(fixtureRef, () =>
        fixtureRef.transaction(
          current => commitFixture(current, expected, assignments),
          undefined, false
        ), true
      );
      if (!outcome.committed) throw Error('CAS aborted: fixture revision or staff changed');
      const bank = (await db.ref(prefix + 'milala_core_banking').get()).val();
      if (bank.revision !== expected.revision + 1) {
        throw Error('Readback: revision did not advance exactly once');
      }
      for (const assignment of assignments) {
        const staffRecords = records(bank.users).filter(x => x.id === assignment.staffId);
        if (staffRecords.length !== 1 || staffRecords[0].uid !== assignment.uid ||
            Object.prototype.hasOwnProperty.call(staffRecords[0], 'password')) {
          throw Error('Readback: staff UID/password not synchronized');
        }
        const profile = (await db.ref(prefix +
          'milala_secure/staffProfiles/' + assignment.uid).get()).val();
        if (!profile || profile.staffId !== assignment.staffId ||
            profile.email !== assignment.identity.email ||
            profile.role !== assignment.identity.role) {
          throw Error('Readback: staff profile not synchronized');
        }
      }
    }
  };
}

module.exports = { enforceEmulator, enforceFixtureScope, commitFixture, createEmulatorAdapter };
