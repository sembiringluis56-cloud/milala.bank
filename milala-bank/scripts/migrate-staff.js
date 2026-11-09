'use strict';

// One-time migration: existing demo staff passwords are moved to Firebase Authentication.
// Run from the project root with --apply only after downloading a Firebase Admin service account.
// The service-account JSON must never be committed to GitHub or uploaded to Vercel.

const fs = require('node:fs');
const path = require('node:path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

const PROJECT_ID = 'luis-sistem-informasi';
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://luis-sistem-informasi-default-rtdb.asia-southeast1.firebasedatabase.app';
const ROOT_PATH = 'milala_core_banking';
const apply = process.argv.includes('--apply');
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!credentialsPath) {
  console.error('ERROR: set GOOGLE_APPLICATION_CREDENTIALS to the path of your Firebase Admin service-account JSON.');
  process.exit(1);
}
if (!fs.existsSync(credentialsPath)) {
  console.error('ERROR: service-account JSON file not found:', credentialsPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
if (serviceAccount.project_id !== PROJECT_ID) {
  console.error(`ERROR: service account project_id must be ${PROJECT_ID}.`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount), databaseURL: DATABASE_URL });
const auth = getAuth();
const db = getDatabase();

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean);
  return [];
}

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

async function findAuthUser(email) {
  try { return await auth.getUserByEmail(email); }
  catch (error) {
    if (error.code === 'auth/user-not-found') return null;
    throw error;
  }
}

async function main() {
  const rootRef = db.ref(ROOT_PATH);
  const snapshot = await rootRef.get();
  if (!snapshot.exists()) throw new Error(`Realtime Database node /${ROOT_PATH} does not exist. Nothing was changed.`);
  const state = snapshot.val();
  state.users = asArray(state.users);
  state.customerUsers = asArray(state.customerUsers);
  state.branches = asArray(state.branches);
  state.customers = asArray(state.customers);
  state.accounts = asArray(state.accounts);
  state.transactions = asArray(state.transactions);
  state.journal = asArray(state.journal);
  state.loans = asArray(state.loans);
  state.audit = asArray(state.audit);
  if (Number(state.version || 0) !== 1) throw new Error('Unexpected MILALA BANK data version. Migration stopped.');
  if (!state.users.length) throw new Error('No staff records found under users. Migration stopped.');

  const backupDir = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `milala-before-auth-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(snapshot.val(), null, 2), { mode: 0o600 });
  console.log('Backup created:', backupPath);

  const prepared = [];
  for (const staff of state.users) {
    const email = String(staff.email || '').trim().toLowerCase();
    const role = String(staff.role || '');
    if (!staff.id || !email.includes('@') || !['admin', 'cs', 'teller', 'manager', 'auditor'].includes(role)) {
      throw new Error(`Invalid staff record encountered (${staff.id || 'missing ID'}). No database data was changed.`);
    }
    let record = staff.uid ? await auth.getUser(staff.uid).catch((error) => {
      if (error.code === 'auth/user-not-found') return null;
      throw error;
    }) : null;
    if (!record) record = await findAuthUser(email);
    const password = String(staff.password || '');
    if (!record && password.length < 8) throw new Error(`No Firebase Auth user exists for ${email}, and the legacy password is missing/too short.`);
    prepared.push({ staff, email, role, record, password });
  }

  console.log(`Found ${prepared.length} staff account(s).`);
  for (const item of prepared) console.log(`- ${item.staff.id}: ${item.email} (${item.role}) ${item.record ? '[Auth account exists]' : '[will create Auth account]'}`);
  if (!apply) {
    console.log('\nDRY RUN ONLY. No Firebase Auth user, custom claim, or database record was changed.');
    console.log('After checking the backup and plan, rerun with --apply to execute the migration.');
    return;
  }

  const profiles = {};
  for (const item of prepared) {
    let record = item.record;
    if (!record) {
      record = await auth.createUser({
        email: item.email,
        password: item.password,
        displayName: String(item.staff.name || item.email),
        disabled: item.staff.active === false
      });
    } else {
      await auth.updateUser(record.uid, {
        email: item.email,
        displayName: String(item.staff.name || item.email),
        disabled: item.staff.active === false
      });
      record = await auth.getUser(record.uid);
    }
    const branch = item.staff.branch || null;
    await auth.setCustomUserClaims(record.uid, {
      staff: true,
      role: item.role,
      staffId: item.staff.id,
      branch
    });
    item.staff.uid = record.uid;
    delete item.staff.password;
    profiles[record.uid] = {
      uid: record.uid,
      staffId: item.staff.id,
      name: String(item.staff.name || item.email),
      email: item.email,
      role: item.role,
      branch,
      active: item.staff.active !== false
    };
  }

  state.customerUsers = state.customerUsers.map((customerUser) => {
    const clean = { ...customerUser };
    delete clean.password;
    return clean;
  });
  state.revision = Number(state.revision || 0) + 1;

  // Atomic compare-and-swap: never overwrite data written after the backup.
  const migrationWrite = await rootRef.transaction((current) => {
    if (!current || stable(current) !== stable(snapshot.val())) return;
    return state;
  }, undefined, false);
  if (!migrationWrite.committed) {
    throw new Error('The database changed during migration. Auth accounts may have been created, but the legacy root was NOT overwritten. Review the backup and current database, then rerun the migration.');
  }

  await db.ref('milala_secure/staffProfiles').update(profiles);
  await db.ref('milala_secure/migration').set({
    status: 'staff-auth-migrated',
    completedAt: new Date().toISOString(),
    staffCount: prepared.length,
    source: 'scripts/migrate-staff.js'
  });
  console.log('\nMigration completed. Legacy customer/account/transaction/journal/loan records were preserved.');
  console.log('Staff passwords were removed from Realtime Database and staff sign-in now uses Firebase Authentication.');
  console.log('Next: deploy database.rules.json and publish the Vercel website/API. The API uses the same Firebase project and legacy database.');
}

main().catch((error) => {
  console.error('\nMIGRATION FAILED:', error.message || error);
  process.exitCode = 1;
});
