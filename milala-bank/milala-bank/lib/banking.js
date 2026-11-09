'use strict';

const { initializeApp, cert, getApps } = require('firebase-admin/app');
class HttpsError extends Error {
  constructor(code, message) { super(message); this.name = 'HttpsError'; this.code = code; }
}
const onCall = (handler) => handler;
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { randomUUID } = require('node:crypto');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'luis-sistem-informasi';
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://luis-sistem-informasi-default-rtdb.asia-southeast1.firebasedatabase.app';
const ROOT_PATH = 'milala_core_banking';
const SECURE_PATH = 'milala_secure';
const STAFF_ROLES = ['admin', 'cs', 'teller', 'manager', 'auditor'];
const STAFF_MUTATION_ROLES = ['admin', 'cs', 'teller', 'manager'];
const ARRAY_FIELDS = ['users', 'customerUsers', 'branches', 'customers', 'accounts', 'transactions', 'journal', 'loans', 'audit'];

const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!serviceAccountRaw) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable. Configure it in Vercel Project Settings.');
}
let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountRaw);
} catch (_) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
}
if (serviceAccount.project_id !== PROJECT_ID) {
  throw new Error(`Firebase service account project_id must be ${PROJECT_ID}.`);
}
if (typeof serviceAccount.private_key === 'string') {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: PROJECT_ID,
    databaseURL: DATABASE_URL
  });
}

const db = () => getDatabase();
const authAdmin = () => getAuth();
const rootRef = () => db().ref(ROOT_PATH);
const secureRef = () => db().ref(SECURE_PATH);
const clone = (v) => JSON.parse(JSON.stringify(v));
const nowIso = () => new Date().toISOString();
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const fail = (code, message) => { throw new HttpsError(code, message); };

function normalizeState(raw) {
  if (!isObj(raw)) return null;
  const state = clone(raw);
  for (const key of ARRAY_FIELDS) {
    const value = state[key];
    state[key] = Array.isArray(value) ? value.filter((x) => x != null) : (isObj(value) ? Object.values(value) : []);
  }
  state.customerUsers = state.customerUsers.map((u) => {
    const clean = { ...u };
    delete clean.password;
    return clean;
  });
  state.users = state.users.map((u) => {
    const clean = { ...u };
    delete clean.password;
    return clean;
  });
  state.settings = isObj(state.settings) ? state.settings : { bankName: 'MILALA BANK', institution: 'PT Bank Milala (Fiktif / Demo)', currency: 'IDR', theme: 'light' };
  state.counters = isObj(state.counters) ? state.counters : { customer: 1, account: 1, transaction: 1, loan: 1, log: 1 };
  state.version = Number(state.version || 1);
  state.revision = Number(state.revision || 0);
  return state;
}

function assertAuth(request) {
  if (!request.auth) fail('unauthenticated', 'Silakan login terlebih dahulu.');
  return request.auth;
}

async function assertStaff(request, allowedRoles = STAFF_ROLES) {
  const auth = assertAuth(request);
  const claims = auth.token || {};
  if (claims.staff !== true || !STAFF_ROLES.includes(claims.role) || !allowedRoles.includes(claims.role)) {
    fail('permission-denied', 'Akses ini hanya tersedia untuk staf dengan hak yang sesuai.');
  }
  const profileSnap = await secureRef().child('staffProfiles').child(auth.uid).get();
  const profile = profileSnap.val();
  if (!profile || profile.active !== true || profile.role !== claims.role || profile.staffId !== claims.staffId) {
    fail('permission-denied', 'Akun staf tidak aktif atau profil akses tidak cocok.');
  }
  return { uid: auth.uid, role: claims.role, staffId: claims.staffId, branch: claims.branch || profile.branch || null, email: auth.token.email || profile.email || '' };
}

async function assertCustomer(request) {
  const auth = assertAuth(request);
  const claims = auth.token || {};
  if (claims.role !== 'customer' || !claims.customerId || claims.email_verified !== true) {
    fail('permission-denied', 'Akun nasabah harus terverifikasi melalui email.');
  }
  const profileSnap = await secureRef().child('customerProfiles').child(auth.uid).get();
  const profile = profileSnap.val();
  if (!profile || profile.active !== true || profile.customerId !== claims.customerId) {
    fail('permission-denied', 'Profil nasabah tidak aktif atau tidak cocok.');
  }
  return { uid: auth.uid, customerId: claims.customerId, email: auth.token.email || profile.email || '' };
}

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (isObj(value)) return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}

function byId(array) {
  const map = new Map();
  for (const item of array) {
    if (!item || typeof item.id !== 'string' || !item.id || map.has(item.id)) fail('invalid-argument', 'Data berisi ID kosong atau duplikat.');
    map.set(item.id, item);
  }
  return map;
}

function getAppendOnlyChanges(oldArray, nextArray, label) {
  const oldMap = byId(oldArray || []);
  const nextMap = byId(nextArray || []);
  for (const [id, oldItem] of oldMap.entries()) {
    const nextItem = nextMap.get(id);
    if (!nextItem || stable(nextItem) !== stable(oldItem)) fail('permission-denied', `${label} lama tidak boleh diubah atau dihapus.`);
  }
  return (nextArray || []).filter((item) => !oldMap.has(item.id));
}

function ensureNoDeletesAndCheck(oldArray, nextArray, label, role, allowedRoles, immutableFields = []) {
  const oldMap = byId(oldArray || []);
  const nextMap = byId(nextArray || []);
  let changed = false;
  for (const [id, oldItem] of oldMap.entries()) {
    const nextItem = nextMap.get(id);
    if (!nextItem) fail('permission-denied', `${label} tidak boleh dihapus dari aplikasi.`);
    if (stable(oldItem) !== stable(nextItem)) {
      changed = true;
      if (!allowedRoles.includes(role)) fail('permission-denied', `Role ${role} tidak boleh mengubah ${label.toLowerCase()}.`);
      for (const field of immutableFields) {
        if (stable(oldItem[field]) !== stable(nextItem[field])) fail('permission-denied', `Kolom ${field} pada ${label.toLowerCase()} tidak boleh diubah.`);
      }
    }
  }
  const added = (nextArray || []).filter((item) => !oldMap.has(item.id));
  if (added.length) {
    changed = true;
    if (!allowedRoles.includes(role)) fail('permission-denied', `Role ${role} tidak boleh menambah ${label.toLowerCase()}.`);
  }
  return { changed, added, oldMap, nextMap };
}

function validateStaffMutation(oldState, nextState, staff) {
  if (!isObj(nextState) || Number(nextState.version) !== 1) fail('invalid-argument', 'Format data MILALA BANK tidak valid.');
  const next = normalizeState(nextState);
  if (!next) fail('invalid-argument', 'Data baru tidak valid.');
  if (stable(oldState.users) !== stable(next.users)) fail('permission-denied', 'Akun staf hanya boleh dikelola melalui Firebase Authentication.');
  if (stable(oldState.customerUsers) !== stable(next.customerUsers)) fail('permission-denied', 'Pemetaan akun nasabah dikelola oleh server.');

  const customerChanges = ensureNoDeletesAndCheck(oldState.customers, next.customers, 'Nasabah', staff.role, ['admin', 'cs'], ['id', 'createdAt', 'authUid']);
  for (const c of customerChanges.added) {
    if (!c.name || String(c.name).trim().length < 3 || !String(c.email || '').includes('@') || !c.identity || c.status !== 'Aktif') fail('invalid-argument', 'Data nasabah baru tidak lengkap atau status awal tidak valid.')
    if (!next.branches.some((b) => b.id === c.branch && b.active)) fail('failed-precondition', 'Cabang nasabah tidak aktif.');
    if (next.customers.filter((x) => String(x.email || '').toLowerCase() === String(c.email).toLowerCase()).length > 1) fail('already-exists', 'Email nasabah sudah digunakan.');
    if (next.customers.filter((x) => String(x.identity || '').toLowerCase() === String(c.identity).toLowerCase()).length > 1) fail('already-exists', 'ID KYC demo sudah digunakan.')
  }

  const accountChanges = ensureNoDeletesAndCheck(oldState.accounts, next.accounts, 'Rekening', staff.role, ['admin', 'cs'], ['id', 'number', 'customerId', 'branch', 'openedAt']);
  for (const a of accountChanges.added) {
    if (!a.number || !a.customerId || !next.customers.some((c) => c.id === a.customerId && c.status === 'Aktif')) fail('invalid-argument', 'Rekening baru harus terhubung ke nasabah aktif.');
    if (!next.branches.some((b) => b.id === a.branch && b.active)) fail('failed-precondition', 'Cabang rekening tidak aktif.');
    if (a.status !== 'Aktif') fail('invalid-argument', 'Rekening baru harus dimulai dengan status Aktif.');
  }
  for (const [id, oldAccount] of accountChanges.oldMap.entries()) {
    const nextAccount = accountChanges.nextMap.get(id);
    if (oldAccount.status !== nextAccount.status && nextAccount.status === 'Ditutup') {
      const currentBalance = next.journal.reduce((sum, line) => sum + (line.account === id ? Number(line.delta || 0) : 0), 0);
      if (currentBalance !== 0) fail('failed-precondition', 'Rekening hanya dapat ditutup jika saldo simulasi Rp0.');
    }
  }
  for (const c of next.customers) {
    if (c.status !== 'Aktif' && next.accounts.some((a) => a.customerId === c.id && a.status === 'Aktif')) fail('failed-precondition', 'Nasabah dengan rekening aktif tidak dapat dinonaktifkan.');
  }
  for (const a of next.accounts) {
    if (!['Tabungan', 'Giro', 'Deposito'].includes(a.product) || !['Aktif', 'Diblokir', 'Ditutup'].includes(a.status)) fail('invalid-argument', 'Jenis atau status rekening tidak valid.');
  }
  for (const c of next.customers) if (!['Aktif', 'Nonaktif'].includes(c.status)) fail('invalid-argument', 'Status nasabah tidak valid.');
  const accountNumbers = next.accounts.map((a) => a.number);
  if (new Set(accountNumbers).size !== accountNumbers.length) fail('already-exists', 'Nomor rekening duplikat.');

  const branchChanges = ensureNoDeletesAndCheck(oldState.branches, next.branches, 'Cabang', staff.role, ['admin'], ['id']);
  for (const b of next.branches) {
    if (!/^[A-Za-z0-9]{2,8}$/.test(String(b.code || '')) || !String(b.name || '').trim() || !String(b.city || '').trim() || typeof b.active !== 'boolean') fail('invalid-argument', 'Data cabang tidak valid.');
    if (!b.active && next.accounts.some((a) => a.branch === b.id && a.status === 'Aktif')) fail('failed-precondition', 'Cabang dengan rekening aktif tidak dapat dinonaktifkan.');
  }
  const branchCodes = next.branches.map((b) => String(b.code || '').toLowerCase());
  if (new Set(branchCodes).size !== branchCodes.length) fail('already-exists', 'Kode cabang duplikat.')
  if (stable(oldState.settings) !== stable(next.settings) && staff.role !== 'admin') {
    const oldSettings = { ...oldState.settings }; const nextSettings = { ...next.settings };
    delete oldSettings.theme; delete nextSettings.theme;
    if (stable(oldSettings) !== stable(nextSettings)) fail('permission-denied', 'Hanya Super Admin yang boleh mengubah identitas sistem.');
  }

  const newTransactions = getAppendOnlyChanges(oldState.transactions, next.transactions, 'Transaksi');
  const newJournal = getAppendOnlyChanges(oldState.journal, next.journal, 'Jurnal');
  const newAudit = getAppendOnlyChanges(oldState.audit, next.audit, 'Audit log');
  if (next.audit.length > 10000) fail('resource-exhausted', 'Audit log demo sudah mencapai batas penyimpanan.');

  const oldLoanMap = byId(oldState.loans);
  const nextLoanMap = byId(next.loans);
  for (const [id] of oldLoanMap.entries()) if (!nextLoanMap.has(id)) fail('permission-denied', 'Riwayat kredit tidak boleh dihapus.');
  const newLoans = next.loans.filter((l) => !oldLoanMap.has(l.id));
  const changedLoans = next.loans.filter((l) => oldLoanMap.has(l.id) && stable(l) !== stable(oldLoanMap.get(l.id)));
  const approvedLoanIds = new Set();
  const repaidLoanIds = new Set();
  const usedPayoutTransactionIds = new Set();
  const usedRepaymentTransactionIds = new Set();

  const txById = new Map(newTransactions.map((t) => [t.id, t]));
  const journalByTx = new Map();
  for (const line of newJournal) {
    if (!journalByTx.has(line.transactionId)) journalByTx.set(line.transactionId, []);
    journalByTx.get(line.transactionId).push(line);
  }
  if (newTransactions.length !== newJournal.length / 2) fail('failed-precondition', 'Setiap transaksi harus memiliki tepat dua entri jurnal.');
  for (const tx of newTransactions) {
    if (!Number.isSafeInteger(tx.amount) || tx.amount <= 0 || tx.amount > 10000000000 || typeof tx.from !== 'string' || typeof tx.to !== 'string' || tx.from === tx.to || tx.status !== 'Berhasil' || !Number.isFinite(Date.parse(tx.date))) fail('invalid-argument', 'Transaksi berisi nominal, tanggal, atau status yang tidak valid.')
    if (tx.actor !== staff.staffId) fail('permission-denied', 'Pelaku transaksi tidak cocok dengan akun staf yang login.');
    const lines = journalByTx.get(tx.id) || [];
    if (lines.length !== 2) fail('failed-precondition', 'Jurnal transaksi tidak lengkap.');
    const debit = lines.find((x) => x.account === tx.from && x.delta === -tx.amount);
    const credit = lines.find((x) => x.account === tx.to && x.delta === tx.amount);
    if (!debit || !credit || lines[0].date !== tx.date || lines[1].date !== tx.date || lines.some((line) => !Number.isSafeInteger(line.delta))) fail('failed-precondition', 'Pasangan jurnal tidak cocok dengan transaksi.')
    const allowedTypes = ['Setor Tunai', 'Tarik Tunai', 'Transfer Internal', 'Pencairan Kredit', 'Angsuran Pokok'];
    if (!allowedTypes.includes(tx.type)) fail('invalid-argument', 'Jenis transaksi tidak diizinkan.');
    if (['Setor Tunai', 'Tarik Tunai', 'Transfer Internal', 'Angsuran Pokok'].includes(tx.type) && !['admin', 'teller', 'manager'].includes(staff.role)) fail('permission-denied', 'Role tidak berwenang mencatat transaksi ini.');
    if (tx.type === 'Pencairan Kredit' && !['admin', 'manager'].includes(staff.role)) fail('permission-denied', 'Hanya Admin atau Manajer yang boleh mencairkan kredit simulasi.');
    if (tx.type === 'Setor Tunai' && tx.from !== 'GL-CASH') fail('invalid-argument', 'Sumber setoran tunai tidak valid.');
    if (tx.type === 'Tarik Tunai' && tx.to !== 'GL-CASH') fail('invalid-argument', 'Tujuan penarikan tunai tidak valid.');
    if (tx.type === 'Pencairan Kredit' && tx.from !== 'GL-LOANFUND') fail('invalid-argument', 'Sumber pencairan kredit tidak valid.');
    if (tx.type === 'Angsuran Pokok' && tx.to !== 'GL-LOANFUND') fail('invalid-argument', 'Tujuan angsuran kredit tidak valid.');
    for (const accountId of [tx.from, tx.to]) {
      if (String(accountId).startsWith('GL-')) continue;
      const linkedAccount = next.accounts.find((a) => a.id === accountId);
      if (!linkedAccount || linkedAccount.status !== 'Aktif' || !next.customers.some((c) => c.id === linkedAccount.customerId && c.status === 'Aktif')) fail('failed-precondition', 'Transaksi hanya boleh memakai rekening dan nasabah yang aktif.');
    }
    if (tx.type === 'Transfer Internal' && (!next.accounts.some((a) => a.id === tx.from) || !next.accounts.some((a) => a.id === tx.to))) fail('invalid-argument', 'Transfer internal harus antar rekening yang dikenal.');
  }
  for (const line of newJournal) if (!txById.has(line.transactionId)) fail('failed-precondition', 'Jurnal tidak boleh ditambahkan tanpa transaksi baru.');

  for (const loan of newLoans) {
    if (!['admin', 'cs', 'manager'].includes(staff.role)) fail('permission-denied', 'Role tidak boleh membuat pengajuan kredit.');
    if (!['Kredit Multiguna', 'Kredit Usaha', 'Kredit Pendidikan', 'Kredit Mikro'].includes(loan.product) || !Number.isSafeInteger(loan.principal) || loan.principal < 100000 || loan.principal > 1000000000 || ![6, 12, 18, 24, 36, 48, 60].includes(Number(loan.term)) || !Number.isFinite(Number(loan.rate)) || Number(loan.rate) < 0 || Number(loan.rate) > 100 || loan.status !== 'Menunggu Persetujuan' || loan.outstanding !== 0 || loan.approvedBy || loan.approvedAt || loan.submittedByUid) fail('invalid-argument', 'Pengajuan kredit baru tidak valid.')
    if (!next.accounts.some((a) => a.id === loan.accountId && a.customerId === loan.customerId && a.status === 'Aktif')) fail('failed-precondition', 'Rekening pengajuan kredit tidak cocok atau tidak aktif.');
  }
  for (const loan of changedLoans) {
    const old = oldLoanMap.get(loan.id);
    for (const field of ['id', 'customerId', 'accountId', 'product', 'principal', 'rate', 'term', 'date', 'submittedByUid']) {
      if (stable(old[field]) !== stable(loan[field])) fail('permission-denied', `Kolom ${field} pada pengajuan kredit tidak boleh diubah.`);
    }
    if (old.status === 'Menunggu Persetujuan' && loan.status === 'Disetujui') {
      if (!['admin', 'manager'].includes(staff.role) || loan.outstanding !== loan.principal || loan.approvedBy !== staff.staffId) fail('permission-denied', 'Persetujuan kredit tidak valid.');
      const payout = newTransactions.find((t) => t.type === 'Pencairan Kredit' && t.from === 'GL-LOANFUND' && t.to === loan.accountId && t.amount === loan.principal);
      if (!payout) fail('failed-precondition', 'Pencairan kredit harus memiliki transaksi pasangan.');
      if (usedPayoutTransactionIds.has(payout.id)) fail('failed-precondition', 'Satu transaksi pencairan tidak boleh dipakai untuk beberapa kredit.');
      usedPayoutTransactionIds.add(payout.id);
      approvedLoanIds.add(loan.id);
      loan.approvedAt = nowIso();
    } else if (old.status === 'Menunggu Persetujuan' && loan.status === 'Ditolak') {
      if (!['admin', 'manager'].includes(staff.role) || loan.outstanding !== 0 || loan.approvedBy !== staff.staffId) fail('permission-denied', 'Penolakan kredit tidak valid.');
      loan.approvedAt = nowIso();
    } else if (old.status === 'Disetujui' && ['Disetujui', 'Lunas'].includes(loan.status)) {
      if (!['admin', 'teller', 'manager'].includes(staff.role) || loan.outstanding < 0 || loan.outstanding >= old.outstanding) fail('permission-denied', 'Pembayaran angsuran tidak valid.');
      if (stable(loan.approvedBy) !== stable(old.approvedBy) || stable(loan.approvedAt) !== stable(old.approvedAt)) fail('permission-denied', 'Metadata persetujuan kredit tidak boleh diubah saat pembayaran.')
      if ((loan.outstanding === 0) !== (loan.status === 'Lunas')) fail('failed-precondition', 'Status lunas tidak sesuai sisa pokok.');
      const paid = old.outstanding - loan.outstanding;
      const repayment = newTransactions.find((t) => t.type === 'Angsuran Pokok' && t.from === loan.accountId && t.to === 'GL-LOANFUND' && t.amount === paid);
      if (!repayment) fail('failed-precondition', 'Angsuran harus memiliki transaksi pasangan.');
      if (usedRepaymentTransactionIds.has(repayment.id)) fail('failed-precondition', 'Satu transaksi angsuran tidak boleh dipakai untuk beberapa kredit.');
      usedRepaymentTransactionIds.add(repayment.id);
      repaidLoanIds.add(loan.id);
    } else {
      fail('permission-denied', 'Perubahan status kredit tidak diizinkan.');
    }
  }

  // Pencairan dan angsuran tidak boleh dibuat tanpa perubahan status/sisa pokok kredit yang cocok.
  for (const tx of newTransactions) {
    if (tx.type === 'Pencairan Kredit' && !usedPayoutTransactionIds.has(tx.id)) fail('failed-precondition', 'Pencairan kredit harus terhubung ke persetujuan kredit yang sah.');
    if (tx.type === 'Angsuran Pokok' && !usedRepaymentTransactionIds.has(tx.id)) fail('failed-precondition', 'Angsuran harus terhubung ke perubahan sisa pokok kredit yang sah.');
  }

  // Semua saldo rekening virtual harus tetap non-negatif.
  for (const account of next.accounts) {
    const balance = next.journal.reduce((sum, line) => sum + (line.account === account.id ? Number(line.delta || 0) : 0), 0);
    if (!Number.isSafeInteger(balance) || balance < 0) fail('failed-precondition', `Saldo rekening ${account.number} tidak boleh negatif.`);
  }

  // Metadata audit baru diberi identitas pelaku dari token server, bukan dari browser.
  for (const entry of newAudit) {
    entry.actor = staff.staffId;
    entry.date = nowIso();
  }
  for (const key of Object.keys(oldState.counters || {})) {
    if (Number(next.counters[key] || 0) < Number(oldState.counters[key] || 0)) fail('permission-denied', 'Counter sistem tidak boleh dikurangi.');
  }
  next.revision = Number(oldState.revision || 0) + 1;
  return next;
}

function customerSnapshot(state, customerId, uid, email) {
  const customer = state.customers.find((c) => c.id === customerId && c.status === 'Aktif');
  if (!customer) fail('permission-denied', 'Profil nasabah tidak aktif atau tidak ditemukan.');
  const accounts = state.accounts.filter((a) => a.customerId === customerId);
  const accountIds = new Set(accounts.map((a) => a.id));
  const transactions = state.transactions.filter((t) => accountIds.has(t.from) || accountIds.has(t.to));
  const txIds = new Set(transactions.map((t) => t.id));
  const journal = state.journal.filter((j) => accountIds.has(j.account) && txIds.has(j.transactionId));
  const loans = state.loans.filter((l) => l.customerId === customerId);
  return {
    state: {
      version: state.version, revision: state.revision,
      users: [], customerUsers: [{ id: uid, uid, customerId, email, active: true }],
      branches: state.branches.filter((b) => b.active), customers: [customer], accounts,
      transactions, journal, loans, audit: [], settings: { bankName: state.settings.bankName || 'MILALA BANK', theme: 'light', currency: 'IDR' },
      counters: {}
    }
  };
}

exports.getPublicInfo = onCall(async () => {
  const state = normalizeState((await rootRef().get()).val());
  if (!state) fail('failed-precondition', 'Data MILALA BANK belum tersedia di Realtime Database. Pulihkan data lama terlebih dahulu.');
  return {
    bankName: state.settings.bankName || 'MILALA BANK',
    institution: state.settings.institution || 'PT Bank Milala (Fiktif / Demo)',
    branches: state.branches.filter((b) => b.active).map((b) => ({ id: b.id, code: b.code, name: b.name, city: b.city, active: true }))
  };
});

exports.getUserContext = onCall(async (request) => {
  const auth = assertAuth(request);
  const uid = auth.uid;
  const token = auth.token || {};
  if (token.staff === true && STAFF_ROLES.includes(token.role)) {
    const snap = await secureRef().child('staffProfiles').child(uid).get();
    const profile = snap.val();
    if (!profile || profile.active !== true || profile.role !== token.role || profile.staffId !== token.staffId) fail('permission-denied', 'Akun staf belum dimigrasikan atau telah dinonaktifkan.');
    return { kind: 'staff', role: profile.role, staffId: profile.staffId, name: profile.name, email: profile.email, branch: profile.branch, active: true };
  }
  if (token.role === 'customer' && token.customerId) {
    const snap = await secureRef().child('customerProfiles').child(uid).get();
    const profile = snap.val();
    if (!profile || profile.active !== true || profile.customerId !== token.customerId) fail('permission-denied', 'Akun nasabah tidak aktif.');
    if (token.email_verified !== true) return { kind: 'verify-email', email: token.email || '' };
    return { kind: 'customer', role: 'customer', customerId: profile.customerId, email: token.email || profile.email || '' };
  }
  const pending = await secureRef().child('pendingRegistrations').child(uid).get();
  if (pending.exists()) return { kind: token.email_verified === true ? 'pending-completion' : 'verify-email', email: token.email || '' };
  fail('permission-denied', 'Akun ini belum memiliki profil MILALA BANK. Hubungi administrator jika ini akun staf.');
});

exports.beginCustomerRegistration = onCall(async (request) => {
  const auth = assertAuth(request);
  if (auth.token?.staff === true || auth.token?.role) fail('permission-denied', 'Akun ini tidak dapat mendaftar sebagai nasabah.');
  const name = String(request.data?.name || '').trim();
  const phone = String(request.data?.phone || '').trim();
  const branchId = String(request.data?.branch || '').trim();
  const address = String(request.data?.address || '').trim().slice(0, 180);
  if (name.length < 3 || name.length > 80 || phone.length < 8 || phone.length > 24 || !branchId) fail('invalid-argument', 'Nama, nomor telepon, dan cabang wajib diisi dengan benar.');
  const email = String(auth.token.email || '').toLowerCase();
  if (!email) fail('failed-precondition', 'Akun Firebase tidak memiliki email.');
  const state = normalizeState((await rootRef().get()).val());
  if (!state || !state.branches.some((b) => b.id === branchId && b.active)) fail('failed-precondition', 'Cabang pilihan tidak tersedia.');
  const existing = await secureRef().child('customerProfiles').child(auth.uid).get();
  if (existing.exists()) fail('already-exists', 'Akun ini sudah terhubung ke profil nasabah.');
  await secureRef().child('pendingRegistrations').child(auth.uid).set({ name, phone, branch: branchId, address, email, createdAt: nowIso() });
  return { ok: true, verificationRequired: true };
});

exports.completeCustomerRegistration = onCall(async (request) => {
  const auth = assertAuth(request);
  if (auth.token?.email_verified !== true) fail('failed-precondition', 'Verifikasi email terlebih dahulu sebelum mengaktifkan rekening simulasi.');
  const userRecord = await authAdmin().getUser(auth.uid);
  if (!userRecord.emailVerified) fail('failed-precondition', 'Email belum diverifikasi.');
  const profileRef = secureRef().child('customerProfiles').child(auth.uid);
  const existingProfile = await profileRef.get();
  if (existingProfile.exists()) {
    const savedProfile = existingProfile.val();
    if (savedProfile.active !== true) fail('permission-denied', 'Profil nasabah dinonaktifkan.');
    await authAdmin().setCustomUserClaims(auth.uid, { role: 'customer', customer: true, customerId: savedProfile.customerId });
    await secureRef().child('pendingRegistrations').child(auth.uid).remove();
    return { ok: true, customerId: savedProfile.customerId };
  }
  if (auth.token?.staff === true || auth.token?.role) fail('permission-denied', 'Akun staf tidak dapat diubah menjadi akun nasabah.');
  const pendingSnap = await secureRef().child('pendingRegistrations').child(auth.uid).get();
  const pending = pendingSnap.val();
  if (!pending) fail('not-found', 'Data pendaftaran tidak ditemukan. Silakan daftar kembali.');
  let createdCustomerId = null;
  let createdProfile = null;
  const result = await rootRef().transaction((current) => {
    if (!current) return;
    const state = normalizeState(current);
    if (state.customerUsers.some((x) => x.uid === auth.uid)) {
      const match = state.customerUsers.find((x) => x.uid === auth.uid);
      createdCustomerId = match.customerId;
      return state;
    }
    if (state.customers.some((c) => String(c.email || '').toLowerCase() === String(pending.email).toLowerCase())) return;
    if (!state.branches.some((b) => b.id === pending.branch && b.active)) return;
    let seq = Number(state.counters.customer || 1);
    let customerId = `NSB-${String(seq).padStart(4, '0')}`;
    while (state.customers.some((c) => c.id === customerId)) { seq += 1; customerId = `NSB-${String(seq).padStart(4, '0')}`; }
    let accountSeq = Number(state.counters.account || 1);
    let accountId = `ACC-${String(accountSeq).padStart(4, '0')}`;
    while (state.accounts.some((a) => a.id === accountId)) { accountSeq += 1; accountId = `ACC-${String(accountSeq).padStart(4, '0')}`; }
    let accountNumber = `ML-${String(1000000000 + accountSeq)}`;
    while (state.accounts.some((a) => a.number === accountNumber)) { accountSeq += 1; accountId = `ACC-${String(accountSeq).padStart(4, '0')}`; accountNumber = `ML-${String(1000000000 + accountSeq)}`; }
    const today = new Date().toISOString().slice(0, 10);
    state.customers.push({ id: customerId, name: pending.name, identity: `DEMO-KYC-${String(seq).padStart(4, '0')}`, email: pending.email, phone: pending.phone, address: pending.address || '', occupation: 'Nasabah Portal Demo', branch: pending.branch, status: 'Aktif', createdAt: today, authUid: auth.uid });
    state.accounts.push({ id: accountId, number: accountNumber, customerId, product: 'Tabungan', branch: pending.branch, status: 'Aktif', openedAt: today });
    state.customerUsers.push({ id: auth.uid, uid: auth.uid, customerId, email: pending.email, active: true, createdAt: nowIso() });
    const logSeq = Number(state.counters.log || 1);
    state.audit.unshift({ id: `LOG-${String(logSeq).padStart(5, '0')}`, date: nowIso(), actor: `CUSTOMER:${customerId}`, action: 'REGISTER', module: 'Portal Nasabah', description: `Registrasi akun simulasi ${pending.name}` });
    state.counters.customer = seq + 1;
    state.counters.account = accountSeq + 1;
    state.counters.log = logSeq + 1;
    state.revision = Number(state.revision || 0) + 1;
    createdCustomerId = customerId;
    createdProfile = { uid: auth.uid, customerId, email: pending.email, active: true, createdAt: nowIso() };
    return state;
  }, undefined, false);
  if (!result.committed) {
    const after = normalizeState((await rootRef().get()).val());
    createdCustomerId = after?.customerUsers.find((x) => x.uid === auth.uid)?.customerId || null;
    if (!createdCustomerId) fail('already-exists', 'Email sudah terhubung ke nasabah lain, cabang tidak aktif, atau data berubah.');
  }
  if (!createdCustomerId) fail('internal', 'Profil nasabah gagal dibuat.');
  const profile = createdProfile || { uid: auth.uid, customerId: createdCustomerId, email: pending.email, active: true, createdAt: nowIso() };
  await profileRef.set(profile);
  await authAdmin().setCustomUserClaims(auth.uid, { role: 'customer', customer: true, customerId: createdCustomerId });
  await secureRef().child('pendingRegistrations').child(auth.uid).remove();
  return { ok: true, customerId: createdCustomerId };
});

exports.getStaffSnapshot = onCall(async (request) => {
  await assertStaff(request);
  const state = normalizeState((await rootRef().get()).val());
  if (!state) fail('failed-precondition', 'Data MILALA BANK belum tersedia.');
  const staff = state.users.find((u) => u.uid === request.auth.uid && u.active === true);
  if (!staff) fail('permission-denied', 'Profil staf tidak ditemukan atau nonaktif.');
  return { state };
});

exports.getCustomerPortalData = onCall(async (request) => {
  const customer = await assertCustomer(request);
  const state = normalizeState((await rootRef().get()).val());
  if (!state) fail('failed-precondition', 'Data MILALA BANK belum tersedia.');
  return customerSnapshot(state, customer.customerId, customer.uid, customer.email);
});

exports.applyCustomerLoan = onCall(async (request) => {
  const customer = await assertCustomer(request);
  const accountId = String(request.data?.accountId || '');
  const product = String(request.data?.product || '').trim();
  const principal = Number(request.data?.principal);
  const term = Number(request.data?.term);
  if (!['Kredit Multiguna', 'Kredit Usaha', 'Kredit Pendidikan', 'Kredit Mikro'].includes(product)) fail('invalid-argument', 'Produk kredit tidak dikenal.');
  if (!Number.isSafeInteger(principal) || principal < 100000 || principal > 1000000000) fail('invalid-argument', 'Nominal pengajuan harus Rp100 ribu sampai Rp1 miliar.');
  if (![6, 12, 18, 24, 36, 48, 60].includes(term)) fail('invalid-argument', 'Tenor tidak valid.');
  let loanId = null;
  const result = await rootRef().transaction((current) => {
    if (!current) return;
    const state = normalizeState(current);
    const owned = state.accounts.find((a) => a.id === accountId && a.customerId === customer.customerId && a.status === 'Aktif');
    const profile = state.customers.find((c) => c.id === customer.customerId && c.status === 'Aktif');
    if (!owned || !profile) return;
    let seq = Number(state.counters.loan || 1);
    loanId = `LN-${String(seq).padStart(4, '0')}`;
    while (state.loans.some((l) => l.id === loanId)) { seq += 1; loanId = `LN-${String(seq).padStart(4, '0')}`; }
    state.loans.push({ id: loanId, customerId: customer.customerId, accountId, product, principal, outstanding: 0, rate: 8, term, status: 'Menunggu Persetujuan', date: new Date().toISOString().slice(0, 10), approvedBy: null, approvedAt: null, submittedByUid: customer.uid });
    const logSeq = Number(state.counters.log || 1);
    state.audit.unshift({ id: `LOG-${String(logSeq).padStart(5, '0')}`, date: nowIso(), actor: `CUSTOMER:${customer.customerId}`, action: 'APPLY', module: 'Kredit', description: `Pengajuan ${loanId} sebesar Rp${principal}` });
    state.counters.loan = seq + 1;
    state.counters.log = logSeq + 1;
    state.revision = Number(state.revision || 0) + 1;
    return state;
  }, undefined, false);
  if (!result.committed || !loanId) fail('failed-precondition', 'Rekening tidak aktif, bukan milik akun ini, atau data berubah.');
  const latest = normalizeState(result.snapshot.val());
  return { loanId, ...customerSnapshot(latest, customer.customerId, customer.uid, customer.email) };
});

exports.commitStaffSnapshot = onCall(async (request) => {
  const staff = await assertStaff(request, STAFF_MUTATION_ROLES);
  const incoming = request.data?.state;
  const expectedRevision = Number(request.data?.expectedRevision);
  if (!isObj(incoming) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) fail('invalid-argument', 'Permintaan perubahan data tidak valid.');
  if (JSON.stringify(incoming).length > 2_000_000) fail('resource-exhausted', 'Snapshot terlalu besar untuk disimpan.');
  let validationError = null;
  const result = await rootRef().transaction((current) => {
    if (!current) { validationError = new HttpsError('failed-precondition', 'Database MILALA BANK kosong.'); return; }
    const oldState = normalizeState(current);
    if (Number(oldState.revision || 0) !== expectedRevision) { validationError = new HttpsError('aborted', 'Data baru saja berubah dari sesi lain. Muat ulang halaman lalu coba kembali.'); return; }
    try { return validateStaffMutation(oldState, incoming, staff); }
    catch (error) { validationError = error instanceof HttpsError ? error : new HttpsError('invalid-argument', error.message || 'Perubahan data tidak valid.'); return; }
  }, undefined, false);
  if (validationError) throw validationError;
  if (!result.committed) fail('aborted', 'Data tidak tersimpan karena konflik perubahan. Muat ulang halaman.');
  return { state: normalizeState(result.snapshot.val()) };
});

exports.manageStaffAccount = onCall(async (request) => {
  const actor = await assertStaff(request, ['admin']);
  const data = request.data || {};
  const id = String(data.id || '').trim();
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const role = String(data.role || '');
  const branch = String(data.branch || '');
  const active = data.active === true;
  const password = String(data.password || '');
  if (name.length < 3 || name.length > 80 || !/^\S+@\S+\.\S+$/.test(email) || !STAFF_ROLES.includes(role) || !branch) fail('invalid-argument', 'Data staf tidak valid.');
  if (!id && password.length < 12) fail('invalid-argument', 'Password awal staf minimal 12 karakter.');
  if (password && password.length < 12) fail('invalid-argument', 'Password baru minimal 12 karakter.');
  const state = normalizeState((await rootRef().get()).val());
  if (!state || !state.branches.some((b) => b.id === branch && b.active)) fail('failed-precondition', 'Cabang tidak ditemukan atau nonaktif.');
  const existing = id ? state.users.find((u) => u.id === id) : null;
  if (id && !existing) fail('not-found', 'Akun staf tidak ditemukan.');
  if (existing && existing.uid === actor.uid && (!active || role !== 'admin')) fail('failed-precondition', 'Super Admin tidak dapat menonaktifkan atau menurunkan role akunnya sendiri.');
  if (state.users.some((u) => u.id !== id && String(u.email).toLowerCase() === email)) fail('already-exists', 'Email staf sudah digunakan.');
  let uid = existing?.uid || null;
  let createdAuthUser = false;
  try {
    if (existing) {
      if (!uid) fail('failed-precondition', 'Akun staf lama belum dimigrasikan. Jalankan skrip migrasi staf terlebih dahulu.');
      const update = { email, displayName: name, disabled: !active };
      if (password) update.password = password;
      await authAdmin().updateUser(uid, update);
    } else {
      const record = await authAdmin().createUser({ email, password, displayName: name, disabled: !active });
      uid = record.uid;
      createdAuthUser = true;
    }
    const staffId = existing?.id || `USR-${randomUUID().slice(0, 8).toUpperCase()}`;
    await authAdmin().setCustomUserClaims(uid, { staff: true, role, staffId, branch });
    const nextState = await new Promise((resolve, reject) => {
      rootRef().transaction((current) => {
        if (!current) return;
        const currentState = normalizeState(current);
        if (id) {
          const target = currentState.users.find((u) => u.id === id);
          if (!target || target.uid !== uid) return;
          Object.assign(target, { name, email, role, branch, active, uid });
        } else {
          if (currentState.users.some((u) => String(u.email).toLowerCase() === email)) return;
          currentState.users.push({ id: staffId, name, email, role, branch, active, uid });
        }
        currentState.revision = Number(currentState.revision || 0) + 1;
        const logSeq = Number(currentState.counters.log || 1);
        currentState.audit.unshift({ id: `LOG-${String(logSeq).padStart(5, '0')}`, date: nowIso(), actor: actor.staffId, action: id ? 'UPDATE_STAFF' : 'CREATE_STAFF', module: 'Pengguna', description: `${email} · ${role} · ${active ? 'Aktif' : 'Nonaktif'}` });
        currentState.counters.log = logSeq + 1;
        return currentState;
      }, (error, committed, snapshot) => {
        if (error) reject(error);
        else if (!committed) reject(new Error('Data staf berubah atau email sudah digunakan. Muat ulang lalu coba kembali.'));
        else resolve(normalizeState(snapshot.val()));
      }, false);
    });
    await secureRef().child('staffProfiles').child(uid).set({ uid, staffId: existing?.id || nextState.users.find((u) => u.uid === uid).id, name, email, role, branch, active });
    return { state: nextState };
  } catch (error) {
    if (createdAuthUser && uid) await authAdmin().deleteUser(uid).catch(() => {});
    if (error instanceof HttpsError) throw error;
    fail('internal', error.message || 'Gagal menyimpan akun staf.');
  }
});
