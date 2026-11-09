# Testing and validation status

## Static checks included in this package
- JSON syntax: `firebase.json`, `.firebaserc`, `database.rules.json`, `vercel.json`, and `package.json`.
- JavaScript syntax: browser files, `lib/banking.js`, `api/[action].js`, and `scripts/migrate-staff.js`.
- Frontend adapter uses same-origin `/api/{action}` calls and does not directly access RTDB.
- API route verifies Firebase ID tokens and checks token revocation.
- API action allowlist is checked.
- Firebase Functions SDK is not used.
- RTDB browser rules are default-deny.

Run:

```powershell
npm install
npm run check
```

## Not tested against live services in this session
No deployment to the user's Vercel or Firebase project has been performed. The service-account secret is not available in this environment. A passing static check does not prove that Vercel environment variables, Auth provider, email verification, live database, and authorization workflows are correctly configured.

## Live test checklist
- [ ] `POST /api/getPublicInfo` returns 200 after deployment.
- [ ] Protected API calls without Bearer token return 401.
- [ ] Invalid or revoked Firebase ID token returns 401.
- [ ] User without staff profile/claims cannot access staff snapshot.
- [ ] Staff role restrictions work server-side.
- [ ] Customer A cannot read Customer B data.
- [ ] Customer cannot change account balance, transaction, journal, or loan status.
- [ ] Customer can submit a loan only for an active account they own.
- [ ] Transaction and journal validations reject tampered data.
- [ ] Direct RTDB reads/writes from browser are denied after rules deployment.
- [ ] Existing `/milala_core_banking` data remains intact.
- [ ] Migration backup is stored outside GitHub and protected.

Use only dummy accounts and simulated data. Do not test with real financial or identity data.
