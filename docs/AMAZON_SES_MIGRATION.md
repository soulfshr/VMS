# Amazon SES Email Migration Plan

> **Status:** Planned (not yet implemented)
> **Current Provider:** Gmail SMTP
> **Target Provider:** Amazon SES
> **Estimated Savings:** ~$225/year at current volume

## Overview

Migrate email sending from Gmail SMTP to Amazon SES for cost-effective mass email at scale.

## Current State

- **Email Library:** Nodemailer with SMTP transport
- **Current Provider:** Gmail SMTP (smtp.gmail.com:587)
- **Email Types:** Shift signup, confirmation, cancellation, coordinator invites
- **Key File:** `src/lib/email.ts`

## Why Amazon SES?

| Factor | Gmail SMTP | Amazon SES |
|--------|-----------|------------|
| Cost | Free (with limits) | ~$1.30/month for 12,800 emails |
| Daily Limit | 500/day (personal) or 2,000/day (Workspace) | Unlimited |
| Scale | Limited | Handles 3,000+ volunteers easily |
| Deliverability | Good | Excellent (with proper setup) |
| Setup | Easy | Moderate (domain verification) |

---

## Migration Plan

### Step 1: AWS SES Setup (Manual - AWS Console)

1. **Create AWS Account** (if not exists)
   - Go to aws.amazon.com
   - Create account with billing info

2. **Set up SES in us-east-1 region**
   - Navigate to Amazon SES
   - Choose US East (N. Virginia) for best deliverability

3. **Verify Domain**
   - Add siembranc.org (or your sending domain)
   - Add DNS records (DKIM, SPF, DMARC):
     - 3 CNAME records for DKIM
     - TXT record for SPF
     - TXT record for DMARC (optional but recommended)

4. **Request Production Access**
   - SES starts in sandbox mode (only verified emails)
   - Submit request to move to production
   - Usually approved within 24 hours

5. **Create SMTP Credentials**
   - Go to SES → SMTP Settings
   - Click "Create SMTP Credentials"
   - Save the username and password (shown once!)

### Step 2: Update Environment Variables

Replace Gmail SMTP credentials with SES:

```env
# Old (Gmail)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="xxxx-xxxx-xxxx-xxxx"

# New (Amazon SES)
SMTP_HOST="email-smtp.us-east-1.amazonaws.com"
SMTP_PORT="587"
SMTP_USER="<SES SMTP username>"
SMTP_PASS="<SES SMTP password>"
EMAIL_FROM="noreply@siembranc.org"
```

### Step 3: Code Changes (Minimal)

**File:** `src/lib/email.ts`

1. Add configurable "from" address (currently might be hardcoded)
2. Ensure `from` field uses verified domain
3. No other changes needed - Nodemailer works with SES SMTP

### Step 4: Vercel Environment Variables

Update in Vercel dashboard:
1. Go to Project → Settings → Environment Variables
2. Update SMTP_* variables for Production and Preview
3. Add EMAIL_FROM variable

### Step 5: Testing

1. Deploy to preview environment
2. Test each email type:
   - Shift signup (RSVP)
   - Shift confirmation
   - Shift cancellation
   - Coordinator invite
3. Verify calendar invites still work
4. Check spam folder / deliverability

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/email.ts` | Use `EMAIL_FROM` env var for sender |
| `.env.example` | Update with SES variable names |
| `CLAUDE.md` | Update tech stack reference |
| Vercel Dashboard | Update environment variables |

---

## DNS Records Needed

For domain verification (add to DNS provider):

```
# DKIM (3 CNAME records - values provided by AWS)
selector1._domainkey.siembranc.org → CNAME → (provided by AWS)
selector2._domainkey.siembranc.org → CNAME → (provided by AWS)
selector3._domainkey.siembranc.org → CNAME → (provided by AWS)

# SPF (TXT record - add to existing or create new)
siembranc.org → TXT → "v=spf1 include:amazonses.com ~all"

# DMARC (TXT record - recommended for deliverability)
_dmarc.siembranc.org → TXT → "v=DMARC1; p=quarantine; rua=mailto:dmarc@siembranc.org"
```

---

## Cost Estimate

| Monthly Volume | Monthly Cost |
|----------------|-------------|
| 12,800 emails | $1.28 |
| 25,000 emails | $2.50 |
| 50,000 emails | $5.00 |
| 100,000 emails | $10.00 |

**Pricing:** $0.10 per 1,000 emails

---

## Rollback Plan

If issues occur, revert to Gmail SMTP:
1. Change Vercel env vars back to Gmail credentials
2. Redeploy
3. No code changes needed

---

## Implementation Timeline

| Step | Duration |
|------|----------|
| AWS Setup & Domain Verification | 1-2 days (DNS propagation) |
| Production Access Request | 24-48 hours |
| Code Changes & Testing | 1 hour |
| Deployment | 10 minutes |

**Total: 2-3 days** (mostly waiting for AWS approval)

---

## When to Migrate

Consider migrating when:
- Gmail daily limits become a bottleneck
- You need to send more than 2,000 emails/day
- You want better deliverability metrics
- You need cost predictability at scale

---

*Last updated: December 2024*
