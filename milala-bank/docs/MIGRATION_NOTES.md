# Migration notes — Firebase Spark + Vercel

- The backend has been moved from Firebase callable Cloud Functions to Vercel Node.js Serverless Functions.
- `api/[action].js` verifies Firebase ID tokens and routes only the allowlisted actions.
- Business logic remains in `lib/banking.js`.
- Browser calls now use `/api/{action}` and never read/write Realtime Database directly.
- Firebase Authentication and the existing Realtime Database remain in the same Firebase project.
- Existing business data under `/milala_core_banking` is preserved; no reset or reseed is performed.
- Staff migration utility is `scripts/migrate-staff.js`.
- Customer accounts from the old prototype are not automatically linked to Firebase Auth. Link them only through a separate verified ownership process.
- Do not deploy Firebase Cloud Functions on Spark. Do not run `firebase deploy --only functions`.
- Deploy database rules only after the Vercel API is configured and tested.
