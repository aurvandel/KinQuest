# Scavenger Hunt Security Specification (SDLC Spec)

This document outlines the strict attribute-based security rules, invariants, and testing payloads for the Scavenger Hunt application.

## 1. Immutable Data Invariants

1. **User Identity Security**: No player can modify others' user records (`/users/{userId}`). Only the authenticated owner of the account matching `request.auth.uid` can modify or register their profile.
2. **Leaderboards Point Integrity**:
   - Users are forbidden from arbitrarily updating their scores. 
   - Modifying `score` or `completedCount` of own user profiles is strictly blocked on direct profile updates, preventing self-awarded points. Score changes must technically fall under an authorized server or batch update triggered upon verified submissions.
3. **Submission Integrity**:
   - A player can only submit under their own authentication ID. The `userId` in any submitted document MUST evaluate to `request.auth.uid`.
   - Once a submission is set to `approved` or `rejected`, the state is locked (terminal state locking).
   - Timestamp integrity: `createdAt` must match `request.time`.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads represent real-world malicious attempts to bypass identity and resource integrity gates. All of these payloads must return `PERMISSION_DENIED`:

### PAA-001 (Identity Spoofing - Profile hijacking)
**Target**: `CREATE/UPDATE /users/attackerUid`
```json
{
  "id": "victimUid",
  "username": "spoofed_nick",
  "score": 0,
  "completedCount": 0,
  "createdAt": "2026-05-31T17:12:17Z"
}
```
*Expected Outcome*: Reject because path parameter `attackerUid` does not match the nested `id` equal to `victimUid`.

### PAA-002 (Points Cheat - Score injection during create)
**Target**: `CREATE /users/attackerUid`
```json
{
  "id": "attackerUid",
  "username": "cheat_master",
  "score": 1000000,
  "completedCount": 50,
  "createdAt": "2026-05-31T17:12:17Z"
}
```
*Expected Outcome*: Rejections because new accounts must start with `score = 0` and `completedCount = 0` via the validation schema helper.

### PAA-003 (Points Cheat - Profile Score modification)
**Target**: `UPDATE /users/attackerUid`
```json
{
  "score": 50000
}
```
*Expected Outcome*: Rejections because the player cannot increase their own score directly.

### PAA-004 (Identity Spoofing - Submit as other user)
**Target**: `CREATE /submissions/sub123`
```json
{
  "id": "sub123",
  "userId": "victimUid",
  "username": "some_victim",
  "itemId": "item_rubber_duck",
  "imageUrl": "data:image/jpeg;base64...",
  "status": "approved",
  "createdAt": "2026-05-31T17:12:17Z"
}
```
*Expected Outcome*: Reject because `userId` must equal `request.auth.uid`.

### PAA-005 (State Shortcutting - Self-approving submissions)
**Target**: `CREATE /submissions/sub124`
```json
{
  "id": "sub124",
  "userId": "attackerUid",
  "username": "malicious",
  "itemId": "item_rubber_duck",
  "imageUrl": "data:image/jpeg;base64...",
  "status": "approved",
  "createdAt": "2026-05-31T17:12:17Z"
}
```
*Expected Outcome*: Reject because initial submissions from clients must only be created in `pending` state. Only administrative logic can mark as `approved`.

### PAA-006 (State Shortcutting - Changing status of locked submission)
**Target**: `UPDATE /submissions/existing_approved_sub`
```json
{
  "status": "approved",
  "imageUrl": "some_different_image_of_vandalism"
}
```
*Expected Outcome*: Reject because existing submissions cannot have their status modified once they are in a terminal state (approved/rejected), or the fields are completely immutable for non-admins.

### PAA-007 (Denial of Wallet - ID characters poisoning)
**Target**: `CREATE /submissions/junk!@#$%^&*()_+{}[]|\\/?`
```json
{
  "id": "junk!@#$%^&*()_+{}[]|\\/?",
  "userId": "attackerUid",
  "username": "poise",
  "itemId": "item_rubber_duck",
  "imageUrl": "data:image/jpeg;base64...",
  "status": "pending",
  "createdAt": "2026-05-31T17:12:17Z"
}
```
*Expected Outcome*: Reject because the custom ID contains illegal non-alphanumeric characters, violating path character limits (`^[a-zA-Z0-9_\-]+$`).

### PAA-008 (Denial of Wallet - Bloated description payload)
**Target**: `CREATE /submissions/sub_large`
```json
{
  "id": "sub_large",
  "userId": "attackerUid",
  "username": "attacker",
  "itemId": "item_rubber_duck",
  "imageUrl": "data:image/jpeg;base64...",
  "status": "pending",
  "aiExplanation": "A string that is 1 megabyte long...",
  "createdAt": "2026-05-31T17:12:17Z"
}
```
*Expected Outcome*: Reject because `aiExplanation` is too large or created by the client (which should start empty or limited in size).

### PAA-009 (Temporal Integrity Override - Forged time)
**Target**: `CREATE /submissions/sub125`
```json
{
  "id": "sub125",
  "userId": "attackerUid",
  "username": "timeshifter",
  "itemId": "item_rubber_duck",
  "imageUrl": "data:image/jpeg;base64...",
  "status": "pending",
  "createdAt": "1999-01-01T00:00:00Z"
}
```
*Expected Outcome*: Reject because the submission timestamp must strictly match the server time `request.time`.

### PAA-010 (Orphaned Write - Invalid reference)
**Target**: `CREATE /submissions/sub126`
```json
{
  "id": "sub126",
  "userId": "attackerUid",
  "username": "attacker",
  "itemId": "nonexistent_mission_item_id",
  "imageUrl": "data:image/jpeg;base64...",
  "status": "pending",
  "createdAt": "2026-05-31T17:12:17Z"
}
```
*Expected Outcome*: Reject because `itemId` must correspond to an actual document in `/items/`.

### PAA-011 (Unauthorized Item Creation - Fake missions)
**Target**: `CREATE /items/new_item`
```json
{
  "id": "new_item",
  "title": "Send me money",
  "description": "Venmo attacker a dollar",
  "points": 999999
}
```
*Expected Outcome*: Reject because general players can only READ items, never create or modify them.

### PAA-012 (PII Coverage - Blanket index reads)
**Target**: `LIST /users` query
```json
"SELECT * FROM users"
```
*Expected Outcome*: Ensure read and list capabilities are secure and cannot leak private metrics, and that public profiles are listable for leaderboards while ensuring no fields can be arbitrarily read or manipulated.

---

## 3. Implementation Notes

This specification was originally written for Firebase/Firestore. **KinQuest now uses Supabase with PostgreSQL Row-Level Security (RLS)** for database access control. The security principles documented above remain valid and should be enforced through Supabase RLS policies in `supabase/init.sql`.
