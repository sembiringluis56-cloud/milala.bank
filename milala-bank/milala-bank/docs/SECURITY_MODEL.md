# Model keamanan — Firebase Spark + Vercel API

## Identity
- Firebase Authentication handles email/password, email verification, password reset, and sessions.
- The browser sends its Firebase ID token as a Bearer token to protected API routes.
- `api/[action].js` verifies the ID token with Firebase Admin SDK, including revoked-token checking.
- Staff role claims and customer profiles are checked again inside `lib/banking.js`.
- Browser-provided role, customer ID, account owner, balance, transaction amount, or approval state is never trusted as authorization evidence.

## Backend
- Vercel Node.js Serverless Functions are the only application backend.
- Only the allowlisted actions in `api/[action].js` can be invoked.
- `getPublicInfo` is the only unauthenticated API action and returns limited public information.
- All other actions require a valid Firebase ID token.
- Business rules and ledger validation live in `lib/banking.js`.
- Service-account JSON is read from the server-only `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable.

## Database
- Existing business data remains under `/milala_core_banking`.
- Server-only mappings remain under `/milala_secure/staffProfiles/{uid}`, `/milala_secure/customerProfiles/{uid}`, and `/milala_secure/pendingRegistrations/{uid}`.
- Browser Security Rules are default-deny (`.read: false`, `.write: false`).
- The Vercel API uses Firebase Admin SDK with service-account credentials. Admin SDK requests bypass Realtime Database Security Rules and have privileged access. This is why token verification, action allowlisting, role checks, input validation, and server-only secret storage are mandatory.

## Ledger safeguards
- Staff snapshot changes use revision checking to reduce stale overwrites.
- Transaction and journal records are validated server-side.
- Each transaction must have its matching pair of journal entries.
- Account balances are computed from journal deltas and must not be negative.
- Loan approval and repayment changes must correspond to matching transactions.
- Customer loan applications are tied to the customer ID in verified token claims and server-side profile mapping.

## Remaining hardening
- Rate limiting and abuse protection are not yet implemented.
- Firebase App Check is not yet enforced by the Vercel API.
- Staff snapshot data is not yet filtered by branch scope.
- Service-account permissions should be least-privilege where practical; restrict who can view/edit Vercel environment variables and rotate the key if exposed.
- Enable monitoring, alerts, backup routines, MFA for staff, and independent security review before broader exposure.

## Not a real bank
All balances and transactions are simulated. Do not enter real identity or financial data or connect real funds.
