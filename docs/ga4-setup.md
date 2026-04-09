# Google Analytics 4 setup

## Create a property

1. Go to https://analytics.google.com/
2. If first time: sign in with Google → click **Start measuring**
3. Otherwise: click the ⚙️ gear (bottom-left) → **Admin**
4. In the **Property** column → **+ Create → Property**

## Property details

- **Property name:** descriptive (e.g. `Personal Portfolio`, `KeyShortcut`)
- **Reporting time zone:** your timezone
- **Currency:** USD or your local

Click **Next**.

## Business details

- **Industry category:** Technology (or your closest match)
- **Business size:** Small — 1 to 10 employees

Click **Next**.

## Business objectives

Check:

- ☑ **Understand web and/or app traffic**
- ☑ **View user engagement & retention**

Click **Create**.

## Create the data stream

- Choose **Web** platform
- **Website URL:** your site URL (e.g. `https://yoursite.com`)
- **Stream name:** descriptive (e.g. `yoursite-web`)
- Leave **Enhanced measurement** ON — auto-tracks scrolls, outbound clicks, file downloads

Click **Create stream**.

## Copy the Measurement ID

A panel appears with **Measurement ID: G-XXXXXXXXXX**.

Copy that value into your `.env`:

```env
VITE_GA4_ID=G-XXXXXXXXXX        # or NEXT_PUBLIC_GA4_ID, PUBLIC_GA4_ID, etc.
```

## Verify it's working

1. `pnpm dev`
2. Open in incognito → click **Accept** on the cookie banner
3. In GA4 → click the bar chart icon (left sidebar) → **Realtime**
4. You should see **1 user in last 30 minutes** within ~30 seconds

## What gets tracked automatically

With **Enhanced measurement** ON:

- Page views (sent manually by `trackPageView()` on every route change)
- Scrolls (90% of page)
- Outbound clicks
- Site search
- Video engagement (YouTube embeds)
- File downloads (PDF, ZIP, etc.)

## Custom events

```js
import { trackEvent } from "./lib/analytics";
trackEvent("contact_form_submitted", { subject: "Job Opportunity" });
```

These appear in GA4 → **Reports → Realtime → Event count by Event name** within 60 seconds.

## Free tier limits

- ✅ Unlimited events
- ✅ 14-month data retention (configurable up to 38 months in some regions)
- ✅ Unlimited users
- ❌ No raw event export to BigQuery on the free tier (paid GA360 only)

## Common issues

**"No data received in past 48 hours" message in Admin**
Ignore it — that page has a ~30 min lag. Use **Reports → Realtime** instead, which is near-instant.

**My visit doesn't show up**
- Ad blocker enabled? Disable or use strict incognito.
- Self-referral filter? Not on by default; only an issue if you set up cross-domain tracking.
- DNS-level blocker (Pi-hole, NextDNS)? Whitelist `googletagmanager.com` and `google-analytics.com`.

**Property is named after a Firebase project I made years ago**
GA4 auto-creates properties for Firebase projects. Either:
- Rename via Admin → Property details → Property name
- Or create a brand new property and update `VITE_GA4_ID` with the new ID
