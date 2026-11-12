'use strict';

// Pure, non-networking candidate for an atomic MILALA BANK root transaction.
// This module has NO Firebase imports and NO production execution path.
// It operates on exactly the production-shaped RTDB root, not a fixture wrapper.
// An actual production migration requires a separately reviewed runner,
// maintenance lock covering all bank writers, recovery mechanism, size audit,
// and verified backups. Do not bypass the --apply safety lock.

const { commitFixture } = require('./staff-migration-emulator-adapter');

const clone = x => JSON.parse(JSON.stringify(x));
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function commitBankRoot(current, { id, owner, expected, assignments } = {}) {
  if (!current || typeof current !== 'object' || Array.isArray(current) ||
      typeof id !== 'string' || !id || typeof owner !== 'string' || !owner ||
      !expected || !Array.isArray(assignments) || !assignments.length) return;

  const secure = current.milala_secure;
  const lock = secure && secure.staffMigrationProgress;
  if (!lock || lock.id !== id || lock.owner !== owner ||
      lock.status !== 'preparing') return;
  if (!secure || typeof secure !== 'object') return;

  // Check customer collisions INSIDE the transaction, not just at preflight.
  const customers = secure.customerProfiles;
  for (const a of assignments) {
    if (!a || typeof a.uid !== 'string' || !a.uid ||
        a.uid.includes('/') || a.uid.includes('.') ||
        a.uid.includes('#') || a.uid.includes('$') ||
        a.uid.includes('[') || a.uid.includes(']')) return;
    if (customers && hasOwn(customers, a.uid)) return;
  }

  // The well-tested fixture updater already applies the exact two paths:
  // /milala_core_banking/users and /milala_secure/staffProfiles, plus
  // a single bank revision increment. Here the argument IS the real root.
  const next = commitFixture(current, expected, assignments);
  if (!next) return;

  // Protect the durable marker from accidental alteration during the commit.
  // Its current contents are retained; advancing its status occurs afterward.
  if (JSON.stringify(next.milala_secure.staffMigrationProgress) !==
      JSON.stringify(lock)) return;

  return next;
}

function auditBankRoot(root) {
  if (!root || typeof root !== 'object') throw Error('Missing bank root');
  const bank = root.milala_core_banking;
  if (!bank || bank.version !== 1 || !Number.isSafeInteger(bank.revision)) {
    throw Error('Unexpected banking version or revision');
  }
  const users = bank.users;
  if (!users || typeof users !== 'object') throw Error('Missing staff users');
  const entries = Object.entries(users).filter(([_, x]) => x && typeof x === 'object');
  const seen = new Set();
  for (const [key, u] of entries) {
    if (!u.id || !u.email || seen.has(u.id)) throw Error('Invalid staff identity at ' + key);
    seen.add(u.id);
  }
  const marker = root.milala_secure?.staffMigrationProgress;
  return Object.freeze({
    version: bank.version,
    revision: bank.revision,
    staffCount: entries.length,
    linkedStaff: entries.filter(([_, u]) => Boolean(u.uid)).length,
    legacyStaff: entries.filter(([_, u]) => !u.uid).length,
    migrationStatus: marker?.status || 'none',
    requiresReconciliation: Boolean(marker && marker.status !== 'completed')
  });
}

module.exports = { commitBankRoot, auditBankRoot };
