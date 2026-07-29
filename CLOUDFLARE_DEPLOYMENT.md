# Stellar Global Supplies — Quote App
## Cloudflare Pages Deployment Guide

> **What changes**: Frontend hosting moves from Vercel to Cloudflare Pages.
> AWS API Gateway, Lambda, and Supabase are **untouched**.
> Custom domain `quote.stellarglobalsupplies.com` stays the same → **no CORS changes needed**.

---

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `frontend/vercel.json` | **Deleted** | Vercel-specific SPA routing config, no longer needed |
| `frontend/public/_redirects` | **Added** | Cloudflare Pages SPA fallback (all routes → `index.html` 200) |
| `frontend/.nvmrc` | **Added** | Pins Node 20 for consistent Cloudflare build |
| `.gitignore` | **Added** | Stops `node_modules`, `dist`, `.DS_Store`, `.env` from being committed |
| `frontend/index.html` | **Updated** | Favicon now points to existing `/logo.png` instead of missing `/favicon.svg` |
| `.DS_Store` files | **Untracked** | Removed from git (kept on disk) |
| `VERCEL_DEPLOYMENT.md` | **Deleted** | Replaced by this guide |

That's it. Cloudflare Pages auto-detects Vite and handles everything else.

---

## Step 1 — Commit the Changes

```bash
git add -A
git commit -m "chore: migrate frontend hosting from Vercel to Cloudflare Pages"
git push origin main
```

---

## Step 2 — Create Cloudflare Pages Project

### Option A — via Dashboard (recommended for first time)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages**
2. **Connect to Git** → connect GitHub → select `Stellar-Global-Supplies/vercel_quote_app`
3. Set **Root directory** to `frontend/`

Cloudflare detects Vite automatically and pre-fills:

| Setting | Value |
|---------|-------|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `frontend` |

Leave all of these as-is.

### Option B — via Wrangler CLI

```bash
cd frontend
npm install -g wrangler
wrangler pages deploy . --project-name=sgs-quote-app
```

> For Git-integrated builds (auto-deploy on push), use Option A.

---

## Step 3 — Set Environment Variables

In the dashboard: **your project** → **Settings** → **Environment variables** (before first deploy), add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_API_URL` | `https://api-quote.stellarglobalsupplies.com` | Production |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Production |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Production |

> Vite bakes `VITE_*` vars into the bundle at build time.
> Cloudflare Pages injects them during `npm run build` automatically.

Click **Save and Deploy**.

---

## Step 4 — Verify on the Pages URL

Cloudflare gives you a preview URL like `sgs-quote-app.pages.dev`.

**API calls will fail here due to CORS** (origin mismatch) — that's expected.
Test only the container/routing behaviour:

```bash
# SPA routing — must return 200, not 404
curl -sI https://sgs-quote-app.pages.dev/quotes
# Expect: HTTP/2 200

# Assets served
curl -sI https://sgs-quote-app.pages.dev/assets/
# Expect: 200 with cache headers

# _redirects file present in build output
curl -sI https://sgs-quote-app.pages.dev/_redirects
# Expect: 200
```

Full app testing happens after custom domain is connected in Step 6.

---

## Step 5 — Lower DNS TTL (if on Route 53)

If your DNS is on **Route 53**, reduce TTL before cutover so rollback is fast:

```
quote.stellarglobalsupplies.com  A     → Vercel/CloudFront alias   TTL: 60
quote.stellarglobalsupplies.com  AAAA  → Vercel/CloudFront alias   TTL: 60
```

Wait for the **current TTL** to fully drain before proceeding
(up to 1 hour if it was 3600s).

> If your DNS is **already on Cloudflare**, TTL is managed by Cloudflare and propagation is near-instant — skip this step.

---

## Step 6 — Add Custom Domain in Cloudflare Pages

1. **your project** → **Custom domains** → **Set up a custom domain**
2. Enter `quote.stellarglobalsupplies.com`
3. Cloudflare Pages provides a CNAME target: `sgs-quote-app.pages.dev`

### If DNS is on Cloudflare
- Cloudflare auto-creates the CNAME record for you. Done.

### If DNS is on Route 53
**Delete** old records:
```
quote.stellarglobalsupplies.com  A     → old alias  ← DELETE
quote.stellarglobalsupplies.com  AAAA  → old alias  ← DELETE
```

**Add** new record:
```
Name:  quote.stellarglobalsupplies.com
Type:  CNAME
Value: sgs-quote-app.pages.dev
TTL:   60
```

TLS certificate activates within 1–2 minutes of DNS propagation.

---

## Step 7 — Validate on the Real Domain

```bash
# DNS propagated
dig quote.stellarglobalsupplies.com CNAME +short
# Returns: sgs-quote-app.pages.dev

# App loads
curl -sI https://quote.stellarglobalsupplies.com
# Expect: HTTP/2 200

# SPA routing
curl -sI https://quote.stellarglobalsupplies.com/quotes
# Expect: HTTP/2 200

# CORS against API Gateway
curl -sI -X OPTIONS https://api-quote.stellarglobalsupplies.com/api/quotes \
  -H "Origin: https://quote.stellarglobalsupplies.com" \
  -H "Access-Control-Request-Method: GET"
# Expect: access-control-allow-origin: https://quote.stellarglobalsupplies.com

# Manual: login → load quotes → create quote → PDF → email
```

---

## Step 8 — Decommission Old Hosting (48h after cutover)

Keep the old hosting (Vercel/CloudFront) live for 48 hours as rollback. Then:

### If previously on AWS S3 + CloudFront
```bash
cd infrastructure/terraform
terraform destroy \
  -target=aws_cloudfront_distribution.frontend \
  -target=aws_s3_bucket_policy.frontend \
  -target=aws_s3_bucket.frontend \
  -target=aws_route53_record.frontend \
  -target=aws_route53_record.frontend_aaaa
```

### If previously on Vercel
- Vercel dashboard → your project → **Settings** → **Delete Project**

Then raise the DNS TTL back up (if on Route 53):
```
Route 53 → CNAME TTL: 60 → 3600
```

---

## CORS — No Changes Needed

Both backend CORS layers are already set to `https://quote.stellarglobalsupplies.com`.
Since the domain doesn't change, nothing on the backend needs touching.

**API Gateway** (`backend.tf`):
```hcl
allow_origins = ["https://quote.stellarglobalsupplies.com"]
```

**Lambda** (`supabase_client.py`):
```python
"Access-Control-Allow-Origin": "https://quote.stellarglobalsupplies.com"
```

---

## Auto-Deploy

Every push to `main` triggers a new Cloudflare Pages build and deploy automatically.
No manual steps needed for routine code updates.

---

## Rollback (if needed)

Old hosting is still live for 48h. Rollback is one DNS swap:

### If DNS on Route 53
```
DELETE: CNAME → sgs-quote-app.pages.dev
ADD:    A/AAAA → old alias  TTL: 60
```

### If DNS on Cloudflare
- Cloudflare dashboard → DNS → delete the Pages CNAME → re-add old A/AAAA records.

Full rollback in under 2 minutes with TTL at 60s.

---

## SPA Routing — How It Works on Cloudflare Pages

The file `frontend/public/_redirects` contains:
```
/*    /index.html   200
```

Vite copies `public/*` into `dist/` during build, so this lands in the build output.
Cloudflare Pages reads `_redirects` and serves `index.html` with HTTP 200 for any path
that isn't a real static file. React Router then renders the correct route client-side.

This is the Cloudflare Pages equivalent of Vercel's `vercel.json` rewrites.

---

## Summary

| | Before | After |
|--|--------|-------|
| Frontend hosting | Vercel | Cloudflare Pages |
| Backend | AWS API Gateway + Lambda | Unchanged |
| Database | Supabase | Unchanged |
| Domain | `quote.stellarglobalsupplies.com` | Unchanged |
| CORS config | Correct | Unchanged |
| SPA routing | `vercel.json` rewrites | `public/_redirects` |
| Files changed | — | See table at top |