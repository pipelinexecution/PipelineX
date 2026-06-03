# PipelineX — Backend Setup & Deployment

## What this does

- Serves your `public/index.html` website
- Accepts audit booking form submissions via `POST /api/audit`
- Emails you instantly when someone submits (Gmail)
- Sends an auto-confirmation email to the lead
- Saves every lead to a local `leads.json` file
- Private admin dashboard at `/admin` to view and manage leads

---

## Local setup (run on your laptop first)

### Step 1 — Clone and install

```bash
git clone https://github.com/YOURUSERNAME/pipelinex-backend.git
cd pipelinex-backend
npm install
```

### Step 2 — Create your .env file

```bash
cp .env.example .env
```

Open `.env` and fill in:

```
SMTP_USER=hello@pipelinex.in
SMTP_PASS=xxxx xxxx xxxx xxxx
NOTIFY_EMAIL=hello@pipelinex.in
ADMIN_TOKEN=make_this_long_and_random
PORT=3000
BASE_URL=http://localhost:3000
```

**How to get your Gmail App Password:**
1. Go to myaccount.google.com
2. Security → 2-Step Verification → App passwords
3. Select "Mail" → Generate
4. Copy the 16-character password into SMTP_PASS (spaces included)

**Generate a strong ADMIN_TOKEN:**
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

### Step 3 — Run locally

```bash
npm start
```

Open http://localhost:3000 — your site is live.
Open http://localhost:3000/admin — enter your ADMIN_TOKEN to see leads.

---

## Deploy to Railway (free, 5 minutes)

Railway is the simplest deployment option. Free tier gives you $5/month credit which is more than enough.

### Step 1 — Push to GitHub

```bash
# On github.com: create a new PRIVATE repo called pipelinex-backend
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOURUSERNAME/pipelinex-backend.git
git branch -M main
git push -u origin main
```

### Step 2 — Deploy on Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init

# Deploy
railway up
```

### Step 3 — Set environment variables on Railway

```bash
railway variables set SMTP_USER=hello@pipelinex.in
railway variables set SMTP_PASS="xxxx xxxx xxxx xxxx"
railway variables set NOTIFY_EMAIL=hello@pipelinex.in
railway variables set ADMIN_TOKEN=your_secret_token_here
railway variables set BASE_URL=https://your-app.up.railway.app
```

Or set them in the Railway dashboard:
- Go to your project → Variables tab
- Add each variable from your .env file

### Step 4 — Get your live URL

```bash
railway domain
```

Railway gives you a URL like `pipelinex-backend-production.up.railway.app`

Update `BASE_URL` in Railway variables to this URL.

---

## Connect your Netlify frontend to this backend

Your `index.html` form already posts to `/api/audit` (relative URL).

**Option A — Serve everything from Railway (simplest)**

Put your `index.html` in the `public/` folder (already done).
Railway serves it at your Railway URL. Done.

**Option B — Netlify frontend + Railway backend**

If you want Netlify for the frontend and Railway for the backend:

1. In your `public/index.html`, change the fetch URL from:
   ```js
   fetch('/api/audit', ...)
   ```
   to:
   ```js
   fetch('https://your-app.up.railway.app/api/audit', ...)
   ```

2. Deploy frontend to Netlify as usual:
   ```bash
   netlify deploy --dir public --prod
   ```

---

## Admin dashboard

Access your leads at:
```
https://your-app.up.railway.app/admin
```

Enter your ADMIN_TOKEN when prompted. You will see:
- Total leads, new, contacted, closed counts
- Every submission with name, company, email, problem, pipelines
- Status dropdown to mark leads as New / Contacted / Closed

---

## File structure

```
pipelinex-backend/
├── server.js          ← Express backend (main file)
├── package.json
├── .env.example       ← Copy this to .env and fill in
├── .env               ← Your secrets (never commit this)
├── .gitignore         ← Ignores .env and leads.json
├── leads.json         ← Auto-created when first lead submits
└── public/
    └── index.html     ← Your website
```

---

## Troubleshooting

**Emails not sending:**
- Make sure 2-Step Verification is ON for your Gmail
- App Password must be for "Mail" specifically
- Check that SMTP_USER and NOTIFY_EMAIL match your Gmail address

**Admin dashboard not opening:**
- Make sure ADMIN_TOKEN in .env matches what you type
- Try accessing `/admin?token=YOUR_TOKEN` directly in the URL bar

**Railway deploy failing:**
- Run `railway logs` to see the error
- Make sure all environment variables are set in Railway dashboard

**Form submits but no email:**
- Check Railway logs: `railway logs`
- The lead is still saved to leads.json even if email fails
- Check your spam folder

---

## Upgrading later

When you're ready to move from `leads.json` to a real database:
- Replace `lowdb` with `pg` (PostgreSQL) — Railway has a free Postgres addon
- Run `railway add postgresql` and update the DB connection in server.js
