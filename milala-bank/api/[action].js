'use strict';

const { getAuth } = require('firebase-admin/auth');
const banking = require('../lib/banking');

const PUBLIC_ACTIONS = new Set(['getPublicInfo']);
const ACTIONS = new Set([
  'getPublicInfo',
  'getUserContext',
  'beginCustomerRegistration',
  'completeCustomerRegistration',
  'getStaffSnapshot',
  'getCustomerPortalData',
  'applyCustomerLoan',
  'commitStaffSnapshot',
  'manageStaffAccount'
]);

const STATUS = {
  'invalid-argument': 400,
  'unauthenticated': 401,
  'permission-denied': 403,
  'not-found': 404,
  'already-exists': 409,
  'aborted': 409,
  'failed-precondition': 409,
  'resource-exhausted': 413,
  'unavailable': 503,
  'internal': 500
};

function sendError(res, status, code, message) {
  return res.status(status).json({
    error: {
      code: code.startsWith('functions/') ? code : `functions/${code}`,
      message: message || 'Permintaan tidak dapat diproses.'
    }
  });
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // Non-browser clients still require Firebase Auth on protected actions.
  const configured = process.env.APP_ORIGIN;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    const originUrl = new URL(origin);
    if (configured && originUrl.origin === new URL(configured).origin) return true;
    return Boolean(host) && originUrl.host === String(host).toLowerCase();
  } catch (_) { return false; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Origin');

  if (!sameOrigin(req)) return sendError(res, 403, 'permission-denied', 'Origin tidak diizinkan.');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return sendError(res, 405, 'invalid-argument', 'Gunakan metode POST.');
  }

  const action = String(req.query?.action || '');
  if (!ACTIONS.has(action) || typeof banking[action] !== 'function') {
    return sendError(res, 404, 'not-found', 'Endpoint tidak ditemukan.');
  }

  let data = req.body || {};
  if (typeof data === 'string') {
    try { data = JSON.parse(data); }
    catch (_) { return sendError(res, 400, 'invalid-argument', 'Body JSON tidak valid.'); }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return sendError(res, 400, 'invalid-argument', 'Body permintaan harus berupa objek JSON.');
  }
  try {
    if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 2_500_000) {
      return sendError(res, 413, 'resource-exhausted', 'Permintaan terlalu besar.');
    }
  } catch (_) {
    return sendError(res, 400, 'invalid-argument', 'Body permintaan tidak valid.');
  }

  let auth = null;
  if (!PUBLIC_ACTIONS.has(action)) {
    const authorization = String(req.headers.authorization || '');
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return sendError(res, 401, 'unauthenticated', 'Sesi login tidak ditemukan. Silakan login kembali.');
    try {
      const decoded = await getAuth().verifyIdToken(match[1], true);
      auth = { uid: decoded.uid, token: decoded };
    } catch (_) {
      return sendError(res, 401, 'unauthenticated', 'Sesi login tidak valid atau sudah dicabut. Silakan login kembali.');
    }
  }

  try {
    const result = await banking[action]({ auth, data });
    return res.status(200).json(result === undefined ? { ok: true } : result);
  } catch (error) {
    const code = String(error?.code || 'internal').replace(/^functions\//, '');
    const status = STATUS[code] || 500;
    const message = status >= 500 ? 'Terjadi kesalahan pada server. Coba lagi nanti.' : (error.message || 'Permintaan tidak dapat diproses.');
    return sendError(res, status, code, message);
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '3mb' } }
};
