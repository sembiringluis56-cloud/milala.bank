# MILALA BANK — Firebase Spark + Vercel Functions

> **Smart Finance Ecosystem update:** 10 add-on finance modules, public/user feedback, admin/manager feedback inbox, and Indonesia/English/中文 language selection. Read [docs/SMART_FINANCE.md](docs/SMART_FINANCE.md) before deploying. Core banking data and previous routes remain separate and available.

**MILALA BANK is an educational banking simulation.** Account balances, transfers, statements, and loans are virtual only. Do not use real money, real identity documents, or real bank-account data.

This release uses:
- Firebase Authentication (Email/Password) for user identity.
- Firebase Realtime Database at the existing project and path.
- Vercel Node.js Serverless Functions for trusted backend endpoints.
- Firebase Admin SDK on Vercel to verify Firebase ID tokens and access the database.
- Default-deny Realtime Database Security Rules for browser clients.

## Existing Firebase project — retained

- Project ID: `luis-sistem-informasi`
- Project number: `592130766717`
- Realtime Database URL: `https://luis-sistem-informasi-default-rtdb.asia-southeast1.firebasedatabase.app`
- Existing business-data root: `/milala_core_banking`
- Server-only access profiles: `/milala_secure`

**The application does not create a new Firebase project or database.** The existing `/milala_core_banking` node is read and updated in place by the server API. Do not reset, reseed, delete, or replace it.

## Why this works on Firebase Spark

Firebase Spark includes Firebase Authentication's common email/password sign-in and a no-cost Realtime Database quota. Cloud Functions for Firebase are not available on Spark, so this project runs the backend as Vercel Functions instead. Firebase product quotas still apply, and Vercel usage limits also apply.

## Project structure

- `index.html`, `assets/`: public website and customer/staff interface.
- `assets/js/store.js`: calls same-origin `/api/{action}` routes; it does not read or write RTDB directly.
- `api/[action].js`: Vercel HTTP API router; verifies Firebase ID tokens before protected operations.
- `lib/banking.js`: trusted business logic, Firebase Admin SDK, server-side role checks, ledger validation.
- `scripts/migrate-staff.js`: one-time local migration of legacy staff accounts.
- `database.rules.json`: default-deny rules for direct browser access.
- `firebase.json`: deploys only the Realtime Database rules through Firebase CLI.

## Security model

- The browser uses Firebase Authentication only.
- For protected API calls, the browser sends its Firebase ID token as a Bearer token.
- The Vercel API verifies the ID token (including revocation check) with Firebase Admin SDK.
- Staff role claims and customer profile mappings are checked server-side.
- The Vercel backend uses a service account stored only as a Vercel environment variable.
- The Admin SDK has privileged access and bypasses Realtime Database Rules. The API therefore must keep its allowlisted routes, verify tokens, and enforce authorization on every protected action.
- Browser clients are denied direct RTDB read/write by `database.rules.json`.

## First-time setup

Read [`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md) and follow its order. Do not deploy default-deny rules until the Vercel API is configured and the backend has been tested.

## Local validation

Install Node.js 22 LTS, then from the project root:

```powershell
npm install
npm run check
```

Do not run `npm --prefix functions install` or `firebase deploy --only functions`; this Spark release has no Firebase Cloud Functions.

## Vercel environment variables

Set these in Vercel → Project → Settings → Environment Variables:

- `FIREBASE_PROJECT_ID` = `luis-sistem-informasi`
- `FIREBASE_DATABASE_URL` = `https://luis-sistem-informasi-default-rtdb.asia-southeast1.firebasedatabase.app`
- `FIREBASE_SERVICE_ACCOUNT_JSON` = complete Firebase service-account JSON, stored as a server-only secret
- `APP_ORIGIN` = exact production website origin, e.g. `https://your-domain.vercel.app`

Never use a `NEXT_PUBLIC_` or `VITE_` prefix for service-account values. Never commit a service-account JSON file, paste it into frontend code, or send it in chat.

## Staff and customer account migration

Legacy staff records are migrated using `scripts/migrate-staff.js`. Run a dry-run first, inspect its local backup, then apply only after checking the accounts. This script uses the same service account locally via `GOOGLE_APPLICATION_CREDENTIALS`. Legacy customer portal accounts are not automatically linked; do not link an old customer solely based on a browser-supplied email.

## Important limitations

This is not a real bank or production financial core. It is an educational simulation. It has not been deployed to your Vercel account or tested against your live Firebase project in this session. Before public launch, complete the test checklist, add rate limiting/App Check where appropriate, review cross-branch data scope, and arrange an independent security review.
