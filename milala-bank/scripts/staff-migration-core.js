'use strict';

// Dependency-injected migration coordinator. No Firebase credentials or network access.
// The production adapter MUST supply an atomic compare-and-swap implementation
// for atomicCommit and a durable writeProgress implementation.
const { createHash } = require('node:crypto');

const ROLES = new Set(['admin', 'cs', 'teller', 'manager', 'auditor']);
const lower = s => String(s || '').trim().toLowerCase();
const records = value => Array.isArray(value) ? value.filter(Boolean) :
  value && typeof value === 'object' ? Object.values(value).filter(Boolean) : [];

function plannedUid(staffId) {
  return 'milala-migrate-' + createHash('sha256')
    .update('milala-bank/staff/v1:' + staffId).digest('hex').slice(0, 40);
}

function validate(staffs, snapshot) {
  if (!snapshot || snapshot.version !== 1 || !Number.isSafeInteger(snapshot.revision)) {
    throw new Error('Preflight: unexpected database version/revision');
  }
  if (!staffs.length) throw new Error('Preflight: no staff records');
  const ids = new Set(), emails = new Set();
  for (const staff of staffs) {
    const id = String(staff?.id || '');
    const email = lower(staff?.email);
    if (!id || !email.includes('@') || !ROLES.has(staff?.role) ||
        ids.has(id) || emails.has(email)) {
      throw new Error('Preflight: invalid or duplicate staff identity');
    }
    ids.add(id); emails.add(email);
  }
}

async function preflight(adapter) {
  const snapshot = await adapter.snapshot();
  const staffs = records(snapshot?.users);
  validate(staffs, snapshot);
  const items = [];

  for (const staff of staffs) {
    const email = lower(staff.email);
    let existing = null;
    if (staff.uid) {
      existing = await adapter.getUser(staff.uid);
      if (!existing || existing.uid !== staff.uid || lower(existing.email) !== email) {
        throw new Error('Preflight: missing/mismatched linked UID for ' + staff.id);
      }
      const claims = existing.customClaims || {};
      if (claims.staff !== true || claims.staffId !== staff.id ||
          claims.role !== staff.role || claims.customerId ||
          claims.branch !== (staff.branch || null)) {
        throw new Error('Preflight: conflicting claims for ' + staff.id);
      }
      if (await adapter.hasCustomerProfile(staff.uid)) {
        throw new Error('Preflight: customer profile linked to staff ' + staff.id);
      }
    } else {
      existing = await adapter.getUserByEmail(email);
      if (existing) throw new Error('Preflight: email already owned by Auth user: ' + staff.id);
      const uid = plannedUid(staff.id);
      if (await adapter.getUser(uid)) {
        throw new Error('Preflight: reserved migration UID occupied: ' + staff.id);
      }
      if (await adapter.hasCustomerProfile(uid)) {
        throw new Error('Preflight: reserved UID has customer profile: ' + staff.id);
      }
      if (String(staff.password || '').length < 12) {
        throw new Error('Preflight: legacy password too short for ' + staff.id);
      }
    }
    items.push({ staff, email, uid: staff.uid || plannedUid(staff.id), isNew: !staff.uid });
  }
  return { snapshot, items };
}

async function migrate(adapter) {
  const plan = await preflight(adapter);
  const newlyCreated = [];
  const allNew = plan.items.filter(item => item.isNew);
  const id = 'mig-' + createHash('sha256')
    .update(JSON.stringify({ revision: plan.snapshot.revision,
      staffIds: plan.items.map(x => x.staff.id).sort() }))
    .digest('hex').slice(0, 20);
  let phase = 'preflight';
  try {
    // Durable marker before *any* mutation of Auth.
    await adapter.writeProgress({ id, status: 'preparing',
      staffIds: plan.items.map(item => item.staff.id) });
    phase = 'auth-preparing';

    for (const item of allNew) {
      // Record UID before createUser call: even a timeout after server success
      // can leave the account. The deterministic UID permits manual recovery.
      newlyCreated.push(item.uid);
      const user = await adapter.createUser({ uid: item.uid,
        email: item.email, password: item.staff.password,
        displayName: item.staff.name || item.email, disabled: true });
      if (user.uid !== item.uid) throw new Error('Auth returned unexpected UID');
    }

    // Adapter contract: one atomic compare-and-swap on the RTDB state.
    // It MUST check snapshot revision + every original staff identity, and
    // commit user UID/password removal and staffProfiles in the same transaction.
    phase = 'database-committing';
    await adapter.atomicCommit({ id, expected: plan.snapshot,
      assignments: plan.items.map(item => ({
        staffId: item.staff.id, uid: item.uid,
        identity: { name: item.staff.name, email: item.email,
          role: item.staff.role, branch: item.staff.branch || null,
          active: item.staff.active !== false }
      })) });
    phase = 'database-committed';
    await adapter.writeProgress({ id, status: phase,
      staffIds: plan.items.map(item => item.staff.id) });

    // Claims only after database/profile are committed. Existing valid Auth
    // users are never re-enabled, altered, or assigned new claims here.
    for (const item of allNew) {
      await adapter.setClaims(item.uid, {
        staff: true, role: item.staff.role, staffId: item.staff.id,
        branch: item.staff.branch || null
      });
    }
    phase = 'activating';
    for (const item of allNew) {
      if (item.staff.active !== false) await adapter.enableUser(item.uid);
    }
    phase = 'completed';
    await adapter.writeProgress({ id, status: phase,
      staffIds: plan.items.map(item => item.staff.id) });
    return { id, status: 'completed', staffCount: plan.items.length };
  } catch (error) {
    // If acquiring the initial marker failed, no Auth/database migration
    // mutation has started. Do not falsely report a *second* marker failure.
    // A marker could still have been written before a network timeout;
    // operator review is needed, but it does not imply enabled accounts.
    if (phase === 'preflight' && newlyCreated.length === 0) {
      const startFailure = new Error('Migration did not start: ' + error.message);
      startFailure.cause = error;
      throw startFailure;
    }
    const disableFailures = [];
    // Preserve least privilege even if some accounts were activated earlier.
    for (const uid of newlyCreated) {
      try { await adapter.disableUser(uid); }
      catch (disableError) { disableFailures.push({ uid, error: String(disableError.message) }); }
    }
    try {
      await adapter.writeProgress({ id, status: 'needs-reconciliation',
        failedPhase: phase, affectedNewUids: newlyCreated,
        disableFailures: disableFailures.map(x => x.uid) });
    } catch (markerError) {
      const critical = new Error('CRITICAL: migration failed and reconciliation marker write failed');
      critical.cause = { original: error, marker: markerError, disableFailures };
      throw critical;
    }
    const failure = new Error('Migration stopped at ' + phase +
      '; manual reconciliation required; new Auth accounts must remain disabled');
    failure.cause = error;
    failure.disableFailures = disableFailures;
    throw failure;
  }
}

module.exports = { migrate, preflight, plannedUid };
