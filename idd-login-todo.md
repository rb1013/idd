# IDD Biometric Login — Design Notes & TODO

## Goal
Allow IDD users to log in entirely via facial recognition / device biometrics after a caregiver completes a one-time setup. No typing, no passwords, no multi-step process for the user.

---

## Current State
- IDD users have their own independent login screen (email + password)
- Guardian creates IDD user accounts (sets email + password)
- `auth_user_id` on `user_profiles` links each IDD user to a Supabase auth account
- Supabase session already uses `persistSession: true` + `autoRefreshToken: true` via `expo-secure-store`

---

## Proposed Flow

### One-time caregiver setup (during user creation)
1. Guardian fills in IDD user details on `CreateUserScreen`
2. At the end of the form, a toggle: **"Enable biometric login on this device"**
3. If enabled → credentials stored in `SecureStore` under that user's ID
4. Guardian never needs to hand over the password or do a separate step
5. Same toggle available later in `EditUserScreen` for existing users (enable or revoke)

### Login screen layout
- Shows a tile grid of everyone associated with this device:
  - **Guardian tile** — always present (hardcoded / stored in SecureStore on first guardian login). Shows guardian avatar + name. Tapping it goes to the existing email + password login form.
  - **IDD user tiles** — one per enrolled IDD user (read from SecureStore index). Shows user avatar + name + fingerprint/face icon.
- No biometric option is shown for the guardian tile — guardians always use email + password.
- If no tiles exist yet (fresh device), show the standard email + password form directly.

### IDD user daily login
1. App opens → login screen renders guardian tile + IDD user tiles
2. IDD user taps their own tile → screen prompts **"Ask your carer to unlock"**
3. Guardian provides their face / fingerprint (their biometric is what's enrolled on the device)
4. On success → app retrieves that IDD user's stored credentials → silent `supabase.auth.signInWithPassword` → User home screen
5. Session stays active until the app is killed (no timeout)

### Guardian daily login
1. Guardian taps their tile → taken to existing email + password login form (no change to current flow)

---

## SecureStore Structure

SecureStore is key-value only — no "list all keys" capability. Solution: maintain an index.

| Key | Value |
|-----|-------|
| `biometric_user_ids` | JSON array of IDD user IDs e.g. `["id1", "id2"]` |
| `biometric_user_<userId>` | JSON object `{ email, password, name, photo_url }` |
| `guardian_profile` | JSON object `{ name, photo_url }` — stored on first guardian login, used to render the guardian tile |

**On setup:** add userId to index array + write credentials entry.
**On revoke:** remove userId from index array + delete credentials entry.
**On login screen load:** read index → fetch each entry → render a card per user.

---

## Key Design Decisions

- **The app does not care whose biometric is enrolled — it just calls the device prompt.** The guardian decides at device setup time whose face/fingerprint to enroll:
  - **Single IDD user on the device** → guardian can enroll the IDD user's own face/fingerprint as the device biometric → IDD user logs in fully independently, no guardian presence needed
  - **Multiple IDD users on the same device** → only one face/fingerprint can be the primary device biometric → guardian enrolls their own → guardian must be physically present to unlock each IDD user's session
- **Guardians never use biometrics for their own login.** Tapping the guardian tile always goes to the email + password form. No biometric option is offered or stored for guardians.
- **A stranger cannot log in as an IDD user** without the enrolled biometric (IDD user's own face or guardian's, depending on setup), even if they have the device.
- **Credentials are device-local.** If the device is replaced, the caregiver must redo setup on the new device. No backend changes required.
- **Multiple IDD users on one device** are supported via the index. Each has their own SecureStore entry; tapping their card retrieves their specific credentials.
- **Session persistence** for direct IDD user logins already works (Supabase SecureStore session). The biometric flow just removes the manual credential entry step.
- **Switching between IDD users** on a single device requires logging out first, then tapping a different IDD user tile on the login screen. There is no in-app user switching while a session is active.

---

## TODO

- [ ] Add "Enable biometric login on this device" toggle to `CreateUserScreen`
- [ ] Add same toggle to `EditUserScreen` (enable / revoke)
- [ ] Implement SecureStore index helpers (read index, add entry, remove entry)
- [ ] On guardian login success, save `guardian_profile` (name, photo_url) to SecureStore for tile rendering
- [ ] Update `LoginScreen` to read SecureStore on mount and render: one guardian tile + N IDD user tiles
- [ ] Guardian tile tap → navigate to existing email + password form (no biometric prompt, no biometric option)
- [ ] Implement biometric prompt using `expo-local-authentication` → on success, retrieve credentials and call `supabase.auth.signInWithPassword`
- [ ] Handle edge cases: biometrics not enrolled on device, biometric failure, device doesn't support it → fall back to standard login gracefully
- [ ] Test multi-user scenario (2 IDD users on same device)
- [ ] Test new device scenario (no SecureStore entries → standard login only)
