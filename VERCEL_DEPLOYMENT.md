# Stellar Global Supplies — Quote App
## Vercel Deployment Guide

> **What changes**: Frontend hosting moves from AWS S3 + CloudFront to Vercel.
> AWS API Gateway, Lambda, and Supabase are **untouched**.
> Custom domain `quote.stellarglobalsupplies.com` stays the same → **no CORS changes needed**.

---

## File Added

Only **one file** was added to the repository:

```
frontend/
└── vercel.json    ← SPA routing rewrites (all routes → index.html)
```

That's it. Vercel auto-detects Vite and handles everything else.

---

## Step 1 — Commit the vercel.json

```bash
git add frontend/vercel.json
git commit -m "chore: add Vercel SPA routing config"
git push origin main
```

---

## Step 2 — Create Vercel Project

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. **Import Git Repository** → connect GitHub → select `stellarglobalsupplies-quote`
3. Set **Root Directory** to `frontend/`

Vercel detects Vite automatically and pre-fills:

| Setting | Auto-filled value |
|---------|------------------|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |

Leave all of these as-is.

---

## Step 3 — Set Environment Variables

In the **Environment Variables** section (before first deploy), add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_API_URL` | `https://api-quote.stellarglobalsupplies.com` | Production |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Production |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Production |

> Vite bakes `VITE_*` vars into the bundle at build time.
> Vercel injects them during `npm run build` automatically.

Click **Deploy**.

---

## Step 4 — Verify on the Vercel URL

Vercel gives you a preview URL like `sgs-quote-abc.vercel.app`.

**API calls will fail here due to CORS** (origin mismatch) — that's expected.
Test only the container/routing behaviour:

```bash
# SPA routing — must return 200, not 404
curl -sI https://sgs-quote-abc.vercel.app/quotes
# Expect: HTTP/2 200

# Assets served
curl -sI https://sgs-quote-abc.vercel.app/assets/
# Expect: 200 with cache headers
```

Full app testing happens after custom domain is connected in Step 6.

---

## Step 5 — Lower Route 53 TTL

Before touching DNS, reduce TTL so rollback is fast if needed:

In Route 53 → your hosted zone:
```
quote.stellarglobalsupplies.com  A     → CloudFront alias   TTL: 60
quote.stellarglobalsupplies.com  AAAA  → CloudFront alias   TTL: 60
```

Wait for the **current TTL** to fully drain before proceeding
(up to 1 hour if it was 3600s).

---

## Step 6 — Add Custom Domain in Vercel

1. Vercel → your project → **Settings → Domains**
2. Add `quote.stellarglobalsupplies.com`
3. Vercel shows a CNAME target: `cname.vercel-dns.com`

Vercel provisions TLS automatically via Let's Encrypt.

---

## Step 7 — Update Route 53 DNS

**Delete** old records:
```
quote.stellarglobalsupplies.com  A     → CloudFront alias  ← DELETE
quote.stellarglobalsupplies.com  AAAA  → CloudFront alias  ← DELETE
```

**Add** new record:
```
Name:  quote.stellarglobalsupplies.com
Type:  CNAME
Value: cname.vercel-dns.com
TTL:   60
```

TLS certificate activates within 1–2 minutes of DNS propagation.

---

## Step 8 — Validate on the Real Domain

```bash
# DNS propagated
dig quote.stellarglobalsupplies.com CNAME +short
# Returns: cname.vercel-dns.com

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

## Step 9 — Decommission S3/CloudFront (48h after cutover)

Keep CloudFront live for 48 hours as rollback. Then:

```bash
cd infrastructure/terraform
terraform destroy \
  -target=aws_cloudfront_distribution.frontend \
  -target=aws_s3_bucket_policy.frontend \
  -target=aws_s3_bucket.frontend \
  -target=aws_route53_record.frontend \
  -target=aws_route53_record.frontend_aaaa
```

Then raise the DNS TTL back up:
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

Every push to `main` triggers a new Vercel build and deploy automatically.
No manual steps needed for routine code updates.

---

## Rollback (if needed)

CloudFront is still live for 48h. Rollback is two DNS swaps:
```
DELETE: CNAME → cname.vercel-dns.com
ADD:    A/AAAA → CloudFront alias  TTL: 60
```
Full rollback in under 2 minutes with TTL at 60s.

---

## Summary

| | Before | After |
|--|--------|-------|
| Frontend hosting | AWS S3 + CloudFront | Vercel |
| Backend | AWS API Gateway + Lambda | Unchanged |
| Database | Supabase | Unchanged |
| Domain | `quote.stellarglobalsupplies.com` | Unchanged |
| CORS config | Correct | Unchanged |
| Files changed | — | `frontend/vercel.json` only |
