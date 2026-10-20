# InstAI – Instagram clone (internship features)

Next.js 16 client (`client/`) + Express 5 / MongoDB / Socket.io API (`server/`).

## Quick start

```bash
# 1. API
cd server
cp .env.example .env          # fill in what you have – everything has a dev fallback
npm install
npm run seed                  # creates the admin account (needs MONGODB_URI)
npm run dev                   # http://localhost:5000
#   no MongoDB handy?  npm run dev:memory   (in-memory DB + auto-seeded admin)

# 2. Web
cd ../client
cp .env.example .env.local    # NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
npm install
npm run dev                   # http://localhost:3000
```

### Admin credentials (created by `npm run seed` / `SEED_ON_START=true`)

| Email | Password |
|---|---|
| `admin@instai.dev` | `Admin@12345` |

Override with `ADMIN_EMAIL` / `ADMIN_PASSWORD` before seeding. The admin dashboard is at **/admin** (also under *More → Admin dashboard*).

### Dev fallbacks (no keys needed to test)
* **Email / SMS** – when `SMTP_*` / `TWILIO_*` / `FAST2SMS_API_KEY` are empty, every OTP, invoice and notification email is printed to the server console (`📧 [DEV EMAIL]`, `📱 [DEV SMS]`).
* **Razorpay** – when `RAZORPAY_KEY_ID/SECRET` are empty, a built-in mock checkout is shown (simulate success / failure). Signature verification still runs (HMAC with a mock secret).
* **MongoDB** – when `MONGODB_URI` is empty, an in-memory MongoDB is started (data lost on restart).
* **Media** – photos/videos are uploaded to the API (`POST /api/upload`, stored in `server/uploads`), so no ImgBB key is needed.

### Tests
```bash
cd server
node scripts/jobs-test.mjs                                   # cron jobs, indexes, time windows (in-memory DB)
BASE=http://localhost:5000 LOG=/path/to/server.log node scripts/e2e.mjs   # 84 end-to-end API checks
```
`e2e.mjs` reads OTP codes from the server log, so start the server with output redirected to a file and no SMTP/SMS keys.

## Features

### 1. Stories + analytics
* Image/video stories, up to 10 media per story, 24 h expiry, caption.
* Privacy: Public / Followers only / Close friends (manage list in *Settings → Close friends* or on a profile).
* Emoji reactions (one per viewer, changeable), replies (into DMs or story-only).
* Highlights (create from *Story archive*, shown on profile).
* Owner insights (`/stories/:id/analytics`): total views, unique viewers, viewer list (paginated), reactions, replies, completion rate, hourly view timeline – live via Socket.io (`story:analytics`).
* `StoryView` has a unique `(story, viewer)` index → a viewer is counted once; views are atomic upserts. Indexed for large view counts.
* Owner can delete before expiry. `node-cron` archives expired stories every 5 min; analytics are retained.

### 2. Multi-language (en, es, hi, pt, zh, fr)
* `client/locales/*.json` + `lib/i18n.tsx` (`useI18n().t`). Menus, forms, validation, server error codes and notifications are translated.
* *Settings → Language*: French → OTP to registered email; any other language → OTP to registered mobile. Stored in `user.language`, so it persists across logins/devices.
* OTP: 6 digits, bcrypt-hashed, 5 min expiry, 3 attempts per code, lockout 15 min after 5 failures, resend cooldown, 5 sends/hour.
* Phone number added to sign-up and profile (E.164 validation).

### 3. Subscriptions (Razorpay)
* Free 1 post · Bronze ₹100 / 3 · Silver ₹300 / 5 · Gold ₹1000 / unlimited (30-day validity). Limit enforced server-side on create & schedule.
* Razorpay order → Checkout → HMAC signature verification; failures, dismissals and bad signatures recorded; renewal extends validity; cancellation keeps benefits to period end; hourly job expires plans and sends renewal reminders; optional webhook (`/api/subscriptions/webhook`).
* Invoice email (invoice no., plan, amount, validity, next renewal date).
* Payments accepted only **05:00–11:00 IST** (server-side; the UI shows the window and disables buttons).

### 4. Login security + history
* Every attempt logged (`LoginHistory`): browser, OS, device type, IP, time, status (success / failed / otp_required / denied / locked) + reason. Shown in *Settings → Login security* and on own profile; admin view under *Login attempts*.
* Chrome → email OTP; Microsoft Edge → no extra step (Edge detected via `Edg/` before Chrome); mobile → only 10:00–13:00 **server time**.
* Password lockout (5 failures / 15 min), OTP limits as above, server-side sessions (revocable, “log out other sessions”), logout revokes token, audit log entries.

### 5. Admin dashboard (`/admin`, role `admin`)
* CRUD for users, posts, scheduled posts, stories, comments, subscriptions, reports (+ read-only login attempts & audit log).
* Filters: date range, user status, plan, report status, verification, post visibility, activity (active in last 7 days), story state/privacy… keyword search, sorting, pagination, summary stats.
* Every admin write is stored in `AuditLog` with before/after values.

### 6. Post scheduling
* Create modal → “Schedule for later” (images, caption, hashtags, tagged users, location). Future dates only, max 2 scheduled per user, counts toward plan limit.
* `/scheduled`: view / edit / reschedule / cancel; error log for failures.
* Scheduler runs every minute, publishes atomically, retries up to 3×, logs errors, emails the user on publish/failure.
* Admin *Scheduled posts* tab with Scheduled / Published / Cancelled / Failed filters, search and date range.

## Environment variables
See `server/.env.example` and `client/.env.example`.

## Deployment

### API → Render
1. Push the repo, then in Render choose **New → Blueprint** and select it (uses `render.yaml`), or create a *Web Service* with root `server`, build `npm ci`, start `npm start`.
2. Set `MONGODB_URI` (MongoDB Atlas – the in-memory DB is dev-only), `CLIENT_URL` (your Vercel URL), `PUBLIC_URL` (the Render URL), `ADMIN_PASSWORD`, and the Razorpay / SMTP / SMS keys.
3. `PORT` is supplied by Render; the server binds to it. `trust proxy` is on so login history records the real client IP from `X-Forwarded-For`. CORS + Socket.io allow the origins in `CLIENT_URL`.
4. `TZ=Asia/Kolkata` makes the mobile-login window (10:00–13:00 server time) IST. The payment window is always computed in IST.
5. Note: Render's free disk is ephemeral – uploaded media in `server/uploads` is wiped on redeploy. Attach a Render Disk mounted at `UPLOAD_DIR`, or move uploads to object storage, for permanent media.

### Web → Vercel
1. Import the repo, set **Root Directory = `client`** (framework auto-detected: Next.js).
2. Env var: `NEXT_PUBLIC_BACKEND_URL=https://<your-render-service>.onrender.com` (also `BACKEND_URL`, same value).
3. Deploy, then put the Vercel URL into the API's `CLIENT_URL`.
