/*
 * MILALA BANK secure data adapter.
 * Browser clients never read/write Realtime Database directly.
 * All sensitive reads/writes go through authenticated same-origin Vercel API routes.
 */
window.MBStore = (() => {
  const ARRAY_FIELDS = ['users', 'customerUsers', 'branches', 'customers', 'accounts', 'transactions', 'journal', 'loans', 'audit'];
  let auth = null;
  let cache = null;

  const deepCopy = (value) => JSON.parse(JSON.stringify(value));
  const blankState = () => ({
    version: 1, revision: 0,
    users: [], customerUsers: [], branches: [], customers: [], accounts: [],
    transactions: [], journal: [], loans: [], audit: [],
    settings: { bankName: 'MILALA BANK', institution: 'PT Bank Milala (Fiktif / Demo)', currency: 'IDR', theme: 'light' },
    counters: {}
  });

  function normalize(state) {
    const value = state && typeof state === 'object' ? deepCopy(state) : blankState();
    ARRAY_FIELDS.forEach((key) => {
      const item = value[key];
      value[key] = Array.isArray(item) ? item.filter(Boolean) : (item && typeof item === 'object' ? Object.values(item).filter(Boolean) : []);
    });
    value.users = value.users.map((user) => { const clean = { ...user }; delete clean.password; return clean; });
    value.customerUsers = value.customerUsers.map((user) => { const clean = { ...user }; delete clean.password; return clean; });
    value.settings = value.settings && typeof value.settings === 'object' ? value.settings : blankState().settings;
    value.counters = value.counters && typeof value.counters === 'object' ? value.counters : {};
    value.revision = Number(value.revision || 0);
    return value;
  }

  function ensureReady() {
    if (!auth) throw new Error('Firebase Authentication belum diinisialisasi.');
  }

  async function call(name, payload = {}) {
    ensureReady();
    const headers = { 'Content-Type': 'application/json' };
    const current = auth.currentUser;
    if (current) headers.Authorization = `Bearer ${await current.getIdToken()}`;
    const response = await fetch(`/api/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify(payload || {})
    });
    let body;
    try { body = await response.json(); }
    catch (_) { body = null; }
    if (!response.ok) {
      const error = new Error(body?.error?.message || `Permintaan backend gagal (${response.status}).`);
      error.code = body?.error?.code || 'functions/internal';
      throw error;
    }
    return body;
  }

  function init() {
    if (!window.firebase) return Promise.reject(new Error('Firebase SDK gagal dimuat. Periksa koneksi internet.'));
    if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.projectId) return Promise.reject(new Error('Konfigurasi Firebase belum tersedia.'));
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = firebase.auth();
    auth.useDeviceLanguage();
    return Promise.resolve(true);
  }

  async function loadPublicInfo() {
    const info = await call('getPublicInfo');
    const state = blankState();
    state.settings.bankName = info.bankName || state.settings.bankName;
    state.settings.institution = info.institution || state.settings.institution;
    state.branches = Array.isArray(info.branches) ? info.branches : [];
    cache = state;
    return deepCopy(info);
  }

  async function getUserContext() {
    return call('getUserContext');
  }

  async function loadStaffSnapshot() {
    const result = await call('getStaffSnapshot');
    cache = normalize(result.state);
    return read();
  }

  async function loadCustomerSnapshot() {
    const result = await call('getCustomerPortalData');
    cache = normalize(result.state);
    return read();
  }

  function read() {
    if (!cache) cache = blankState();
    return deepCopy(cache);
  }

  async function commit(mutator) {
    if (typeof mutator !== 'function') throw new Error('Perubahan data tidak valid.');
    const next = read();
    mutator(next);
    const result = await call('commitStaffSnapshot', { state: next, expectedRevision: Number(cache?.revision || 0) });
    cache = normalize(result.state);
    return read();
  }

  async function manageStaffAccount(payload) {
    const result = await call('manageStaffAccount', payload);
    cache = normalize(result.state);
    return read();
  }

  async function applyCustomerLoan(payload) {
    const result = await call('applyCustomerLoan', payload);
    cache = normalize(result.state);
    return read();
  }

  // Smart Finance is stored in an isolated per-UID path, never in the core banking ledger.
  async function getFinanceWorkspace() { return call('getFinanceWorkspace'); }
  async function saveFinanceWorkspace(workspace, expectedRevision) {
    return call('saveFinanceWorkspace', { workspace, expectedRevision });
  }
  async function submitFeedback(payload) { return call('submitFeedback', payload); }
  async function getFeedback() { return call('getFeedback'); }

  async function registerCustomer(email, password, profile) {
    ensureReady();
    const credential = await auth.createUserWithEmailAndPassword(String(email).trim().toLowerCase(), password);
    let pendingCreated = false;
    try {
      await credential.user.updateProfile({ displayName: String(profile.name || '').trim() });
      await call('beginCustomerRegistration', profile);
      pendingCreated = true;
      await credential.user.sendEmailVerification();
      return credential.user;
    } catch (error) {
      // If the server never stored the pending registration, remove the orphan Auth account.
      if (!pendingCreated) await credential.user.delete().catch(() => {});
      throw error;
    }
  }

  async function signIn(email, password) {
    ensureReady();
    const credential = await auth.signInWithEmailAndPassword(String(email).trim().toLowerCase(), password);
    return credential.user;
  }

  async function signOut() {
    ensureReady();
    await auth.signOut();
    cache = blankState();
  }

  async function completeCustomerRegistration() {
    ensureReady();
    const current = auth.currentUser;
    if (!current) throw new Error('Silakan login terlebih dahulu.');
    await current.reload();
    if (!current.emailVerified) throw new Error('Email belum diverifikasi. Buka tautan verifikasi yang dikirim ke email kamu.');
    await current.getIdToken(true);
    const result = await call('completeCustomerRegistration');
    await current.getIdToken(true);
    return result;
  }

  async function resendVerification() {
    ensureReady();
    if (!auth.currentUser) throw new Error('Sesi pendaftaran tidak ditemukan. Silakan login kembali.');
    await auth.currentUser.sendEmailVerification();
  }

  async function sendPasswordReset(email) {
    ensureReady();
    try { await auth.sendPasswordResetEmail(String(email).trim().toLowerCase()); }
    catch (error) {
      // Keep the UI response generic to avoid revealing whether an email is registered.
      if (['auth/user-not-found', 'auth/invalid-email'].includes(error.code)) return;
      throw error;
    }
  }

  async function changePassword(oldPassword, newPassword) {
    ensureReady();
    const current = auth.currentUser;
    if (!current || !current.email) throw new Error('Sesi login tidak ditemukan.');
    const credential = firebase.auth.EmailAuthProvider.credential(current.email, oldPassword);
    await current.reauthenticateWithCredential(credential);
    await current.updatePassword(newPassword);
  }

  function onAuthStateChanged(callback) {
    ensureReady();
    return auth.onAuthStateChanged(callback);
  }

  function currentUser() {
    ensureReady();
    return auth.currentUser;
  }

  function balance(state, accountId) {
    return (state.journal || []).reduce((sum, entry) => sum + (entry.account === accountId ? Number(entry.delta || 0) : 0), 0);
  }

  return {
    init, loadPublicInfo, getUserContext, loadStaffSnapshot, loadCustomerSnapshot,
    read, commit, manageStaffAccount, applyCustomerLoan,
    getFinanceWorkspace, saveFinanceWorkspace, submitFeedback, getFeedback,
    registerCustomer, signIn, signOut, completeCustomerRegistration, resendVerification,
    sendPasswordReset, changePassword, onAuthStateChanged, currentUser, balance
  };
})();
