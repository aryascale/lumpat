# Docker, Performance & Auth Flow Refactor

## Objectives
1. **Docker Setup**: Create a `docker-compose.yml` for MySQL and phpMyAdmin, and update `.env` to connect to it.
2. **Google Auth Refactor**: Transition from the simple ID Token flow to the **Server-Side Authorization Code Flow** using `oauth2Client.getToken(code)` as requested.
3. **Performance Optimization**: Brainstorm and implement fixes for the slow image loading on the Landing Page.

## Proposed Changes

### 1. Docker Infrastructure
- Create `docker/docker-compose.yml` defining `mysql` and `phpmyadmin` services.
- `mysql` will run on port `3306` with user `admin`/`admin`.
- `phpmyadmin` will run on port `8080`.

### 2. Configuration
- Update `.env` `DATABASE_URL` to point to the new Docker MySQL instance (`mysql://admin:admin@localhost:3306/bcr_db`).
- Add `GOOGLE_CLIENT_SECRET` (Required for the Authorization Code flow).

### 3. Frontend Updates
- **Performance**: Update image source paths in `LandingPage.tsx` to point to `.webp` versions. Implement lazy loading.
- **Auth**: Change `<GoogleLogin>` in `Login.tsx` to use the `useGoogleLogin({ flow: 'auth-code' })` hook to generate an authorization code.

### 4. Backend Updates
- Replace `verifyIdToken` in `/api/auth-google.ts` with `oauth2Client.getToken(code)` to exchange the code for access/refresh tokens.
- Fetch the user's profile using the newly acquired access token.

## Verification Checklist (Phase X)
- [ ] `docker-compose up -d` starts MySQL and phpMyAdmin successfully.
- [ ] `npx prisma db push` connects to the Docker database.
- [ ] phpMyAdmin is accessible at `http://localhost:8080` with `admin`/`admin`.
- [ ] Google Auth Authorization Code Flow successfully logs the user in.
- [ ] Landing page images load instantly using WebP and lazy loading.
- [ ] Standard features (Login, Registration, Profile OTP, Event Registration) work with the new Docker database.
