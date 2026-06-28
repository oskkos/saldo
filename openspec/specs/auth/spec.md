# auth Specification

## Purpose

Authentication and account lifecycle: signing up, signing in (email/password and
OAuth), resolving the current user from the session, and resetting a forgotten
password. Every other capability depends on this one — server-side data access is
gated by `getUserFromSession()`.

This spec was reverse-engineered from `src/auth/authSession.ts`,
`src/repository/userRepository.ts`, `src/actions/index.ts`, the `src/schemas/`
Zod schemas, and the Prisma `User`/`PasswordResetData` models. It documents
current behavior, not a desired future state. Items that look like defects or
gaps are listed under "Open Questions" rather than written as blessed
requirements.

## Requirements

### Requirement: Email/password sign-in

The system SHALL authenticate a user by email and password via a NextAuth
Credentials provider, returning the user on a bcrypt password match and failing
sign-in otherwise.

#### Scenario: Correct credentials

- **GIVEN** a user with a stored bcrypt password hash
- **WHEN** they submit the matching password
- **THEN** sign-in succeeds and a session is established

#### Scenario: Wrong password or unknown email

- **WHEN** the password does not match, or no user exists for the email, or the user has no stored password
- **THEN** sign-in fails and returns no user

### Requirement: OAuth sign-in

The system SHALL support signing in with Google and GitHub providers.

#### Scenario: First OAuth sign-in provisions the account

- **GIVEN** a user signing in with Google or GitHub for the first time
- **WHEN** authentication succeeds
- **THEN** an account is provisioned for their email with no stored password

### Requirement: JWT session with user id

The system SHALL use a JWT session strategy and SHALL make the user's numeric
database id available as `session.user.id`. On sign-in the id is resolved and
stored on the token; on later requests it is backfilled from the email if absent.

#### Scenario: Id surfaced on the session

- **GIVEN** an authenticated request
- **WHEN** the session is read
- **THEN** `session.user.id` holds the user's numeric database id

### Requirement: Server-side auth gate

The system SHALL provide `getUserFromSession()` returning the current user only
when the session has both an email and a numeric id, and null otherwise. Server
code uses this as the authorization gate.

#### Scenario: Incomplete session

- **WHEN** the session lacks an email or a numeric id
- **THEN** `getUserFromSession()` returns null and callers treat the request as unauthenticated

### Requirement: First sign-in provisions user and seeds settings

On sign-in the system SHALL upsert the user by email (creating them or updating
their name) and SHALL seed a default `Settings` row if one does not already
exist. Seeding SHALL be idempotent — an existing settings row is left unchanged.

#### Scenario: Returning user

- **GIVEN** a user who already has settings
- **WHEN** they sign in again
- **THEN** their user record is upserted and their existing settings are not overwritten

### Requirement: Sign-up with validated credentials

The system SHALL register a new email/password user only after validating input:
a valid email, a non-empty name, a password of 8–20 characters, and a matching
confirmation. The password SHALL be stored as a bcrypt hash. Sign-up SHALL fail
if a user with that email already exists.

#### Scenario: Valid sign-up

- **GIVEN** valid, matching sign-up data for a new email
- **WHEN** sign-up is submitted
- **THEN** a user is created with a bcrypt-hashed password

#### Scenario: Invalid input

- **WHEN** the email is malformed, the name is empty, the password is out of the 8–20 range, or confirmation does not match
- **THEN** sign-up returns a field-level error status and no user is created

#### Scenario: Duplicate email

- **GIVEN** an email already registered
- **WHEN** sign-up is submitted for it
- **THEN** the operation fails

### Requirement: Forgot-password does not reveal account existence

The system SHALL validate the submitted email and, when a matching user exists,
generate a single-use reset token, store only its SHA-256 hash with a one-hour
expiry, and email the raw token to the user. When no user matches, the system
SHALL return the same success result without sending mail.

#### Scenario: Known email

- **GIVEN** a registered email
- **WHEN** a password reset is requested
- **THEN** a hashed, one-hour token is stored and a reset email is sent

#### Scenario: Unknown email

- **GIVEN** an email with no account
- **WHEN** a password reset is requested
- **THEN** the response is an identical success and no email is sent

### Requirement: Reset password with a valid token

The system SHALL reset a password only when given a non-expired reset token and a
valid new password (8–20 characters, matching confirmation). On success it SHALL
store the new bcrypt hash and delete the used reset token. An invalid or expired
token SHALL fail.

#### Scenario: Valid token

- **GIVEN** a non-expired reset token and a valid matching new password
- **WHEN** the reset is submitted
- **THEN** the password is updated and the token is consumed

#### Scenario: Expired or unknown token

- **WHEN** the token is expired or does not match any stored hash
- **THEN** the reset fails and no password is changed

## Open Questions

These are behaviors observed in the code that are ambiguous or potentially
worth revisiting. They are NOT to be treated as intended requirements until
resolved.

- **20-character password ceiling.** Both sign-up and reset cap passwords at 20
  characters. This is well below bcrypt's 72-byte limit and blocks passphrase
  managers. Deliberate product choice or an accidental tight bound?
- **Internal inconsistency in credential check.** `getUserByEmailAndPassword`
  returns null for an unknown user but *throws* on a wrong password; the action
  catches the throw and normalizes both to null. The externally observable
  behavior is safe (no enumeration), but the internal contract is inconsistent.
- **Sign-up race.** `signupUser` checks existence then creates; concurrent
  requests rely on the DB unique constraint to reject the loser, which would
  surface as an unhandled error rather than the friendly "already exists" path.
