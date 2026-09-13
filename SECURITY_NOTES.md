# Security Advisory & Incident Notes

## 2026-09-13: Removal of Hardcoded Fallback Secrets and Rotation Notice

### Summary
During a comprehensive security audit, hardcoded fallback secrets were discovered in the codebase:
1. **JWT Signing Fallback Secret**: A fallback secret string was present in `server.ts` alongside automatic disk-based secret generation (`data/.jwt_secret`).
2. **Google Calendar Token Encryption Key**: A default fallback encryption key string was present in `src/domain/utils/calendarEncryption.ts`.

Both fallback secrets and silent generation mechanisms have been **completely removed**. The application now enforces a strict, fail-closed zero-trust security policy.

### Required Actions for Operators
Anyone who has ever deployed or run this application in a production or shared environment **MUST**:
1. **Configure Environment Secrets**:
   - Set a cryptographically secure `JWT_SECRET` (at least 32 characters long).  
     Generate with: `openssl rand -hex 32`
   - Set a cryptographically secure `CALENDAR_TOKEN_ENCRYPTION_KEY` (at least 32 characters long).  
     Generate with: `openssl rand -hex 32`
2. **Refusal to Boot on Missing Secrets**:
   - If `JWT_SECRET` is missing or shorter than 32 characters, the server immediately logs a fatal error and exits with code 1 (`process.exit(1)`). It will refuse to serve any traffic.
   - If `CALENDAR_TOKEN_ENCRYPTION_KEY` is missing or shorter than 32 characters, calendar token encryption and decryption will fail immediately with an explicit error requiring operator configuration.
3. **Session and Token Invalidation**:
   - Treat any JWT signed before this update or any Google Calendar account connected with the legacy fallback key as compromised.
   - On deployment, the application automatically executes a one-time startup migration that clears the token denylist and invalidates all pre-rotation user sessions (`sessionsRevokedAt` bumped to current timestamp).
   - Any previously connected Google Calendar accounts must be re-authorized to re-encrypt tokens with the new private encryption key.
