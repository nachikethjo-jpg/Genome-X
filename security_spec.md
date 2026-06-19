# Security Specification & Threat Model (Attribute-Based Access Control)

## Data Invariants

1. **User Ownership Boundaries**: No authenticated explorer can read, write, update, or list another user's genomic analysis runs.
2. **Profile Integrity**: A user can only register or edit their own profile matching `request.auth.uid`. They cannot hijack another user's document ID or supply a modified email address.
3. **Verified Email Mandate**: To execute writes (create/update), users must be fully authenticated and verified with Google (`request.auth.token.email_verified == true`).
4. **Temporal Integrity**: The fields `createdAt` must match `request.time` on creations, and cannot be modified thereafter.
5. **Acyclic Key Safety**: No arbitrary parameters or payload overflow vectors can be written to firestore documents. The validation helpers will check exact keys.

---

## The "Dirty Dozen" Payloads

The following payloads attempt to violate security boundaries and must be blocked with `PERMISSION_DENIED` by the firestore rules logic:

1. **ID Injection (Project / Locus Poisoning)**: Write an analysis run using a 1MB string or high-charset junk in `{analysisId}`.
2. **User Profile Spoofing**: Attempting to create a profile under `/users/other-user-uid/public/profile` using your own auth token.
3. **Anomalous Field Insertion**: Including `role: "admin"` in user profiles.
4. **Sequence Data Flooding**: Creating an analysis record where base parameters contain raw 5MB mock base sequences.
5. **No-Verification Writing**: Writing a genomic simulation run with a verified state but `email_verified: false` in the token.
6. **Mutated Owner Hijacking**: Updating a run to reassign `ownerId` or `userId` to a colleague.
7. **Temporal Fraud**: Setting `createdAt` to a historical epoch timestamp (e.g., year 2000) instead of standard `request.time`.
8. **Null-Origin Sequence Insertion**: Sending negative indices, null reference translations, or invalid JSON structures.
9. **Synonymous Key Drift**: Overwriting standard profile documents with empty property collections or missing required items.
10. **State Corruption (Terminal Locking)**: Modifying sequence indicators or alignment metrics of an analysis that has already been validated.
11. **Pillaging Global Users Logs**: Running list queries on `/users` collection directly to map researcher directories without strict filters.
12. **Double-Click Lock bypass**: Bypassing intermediate stages during state changes (such as skipping calculations).

---

## The Test Runner File (`firestore.rules.test.ts`)

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

// Verification test suite to run against DRAFT_firestore.rules
describe("Genomic Sequencing Platform Security", () => {
  let testEnv: any;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "regal-habitat-4lrqd",
      firestore: {
        rules: require('fs').readFileSync('firestore.rules', 'utf8')
      }
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it("should prevent unauthenticated reads of profile lists", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthedDb.collection("users").get());
  });

  it("should block spoofed profile creation", async () => {
    const userDb = testEnv.authenticatedContext("user_abc", { email_verified: true }).firestore();
    await assertFails(
      userDb.doc("users/user_xyz/public/profile").set({
        username: "hacker",
        email: "hacker@domain.com",
        createdAt: new Date()
      })
    );
  });
});
```
