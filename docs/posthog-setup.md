# PostHog setup

PostHog gives you **product analytics, funnels, feature flags, A/B tests, and session recordings** in one tool.

## US vs EU cloud — pick one

PostHog hosts two clouds. Pick based on where your users are:

| Cloud | Signup URL | Host (for `.env`) |
|---|---|---|
| **US Cloud** (faster for North America) | https://us.posthog.com/signup | `https://us.i.posthog.com` |
| **EU Cloud** (GDPR data residency) | https://eu.posthog.com/signup | `https://eu.i.posthog.com` |

You **cannot** mix — projects belong to one cloud or the other.

## Create a project

1. Sign up at one of the URLs above
2. Pick a workspace name (or accept default)
3. PostHog will ask for a project name → use a descriptive one (e.g. `Personal Portfolio`, `KeyShortcut`)

## Get the API key

After project creation, you'll land on the dashboard:

1. Click **Project Settings** (gear icon, bottom-left)
2. Scroll to **Project Variables**
3. Find **Project API Key** — looks like `phc_xxxxxxxxxxxx` (~40 chars)
4. Click the copy icon

## Add to `.env`

```env
VITE_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_POSTHOG_HOST=https://us.i.posthog.com   # or eu.i.posthog.com
```

For Next.js: use `NEXT_PUBLIC_` prefix. For Astro: `PUBLIC_`.

## Verify it's working

1. `pnpm dev`
2. Open in incognito → click **Accept**
3. DevTools → Network tab → filter by `posthog`
4. You should see `us.i.posthog.com/e/?ip=0&...` (200)
5. Open https://us.posthog.com/project/<id>/activity → **Live events**
6. Within 30 seconds you should see your `$pageview` event appear

## What gets tracked automatically

By default:

- `$pageview` (fired manually by `trackPageView()` on route change)
- `$autocapture` (clicks, form submits — automatic)
- `$session_id`, `$device_id` (session/device tracking)
- `$browser`, `$os`, `$device_type` (UA-based metadata)
- `$current_url`, `$referrer`, `$referring_domain` (page context)

## Custom events

```js
import { trackEvent } from "./lib/analytics";

trackEvent("project_clicked", {
  title: "EntryCall",
  category: "saas",
  variant: "card",
});
```

These appear in PostHog → **Activity → Live events** within ~10 seconds.

## Funnels

PostHog's killer feature: build conversion funnels from your custom events.

Example: Hero CTA → Contact form submission

1. PostHog → **Insights → New insight → Funnel**
2. Step 1: `cta_clicked` (where `label = "Hire Me"`)
3. Step 2: `contact_form_submitted`
4. Save → see conversion rate over time

## Free tier limits

- ✅ **1M events per month** (for product analytics)
- ✅ **5K session recordings per month**
- ✅ **1M feature flag requests per month**
- ✅ Unlimited team members
- ✅ 1-year data retention
- ❌ Anonymous events count toward the 1M limit

For most personal sites/portfolios, you'll never hit these limits.

## Multiple projects vs one project

If you have multiple sites (portfolio + side projects), you have two options:

**Option A: One PostHog project for everything**
- Pros: One dashboard, one API key, simple
- Cons: Mixed traffic — harder to compare per-site
- Use a property like `site: "portfolio"` on every event to filter

**Option B: One PostHog project per site**
- Pros: Clean separation, per-site dashboards
- Cons: More API keys to manage, separate user counts
- **Recommended** if you have 2+ sites

## Common issues

**Events don't appear in Live events**
- Wait 30 seconds (PostHog batches)
- Check the Network tab — is the request hitting `posthog.com`?
- Check the API key has no extra spaces or quotes in `.env`
- Check `VITE_POSTHOG_HOST` matches your cloud (US vs EU)

**`Failed to load resource: posthog-js`**
Check `posthog-js` is in `package.json` `dependencies`. If not: `pnpm add posthog-js`.

**Bundle is huge**
PostHog SDK is ~50KB gzipped. The analytics-stack template lazy-imports it (`await import("posthog-js")`), so it's only loaded after consent — not in your initial bundle.

**CSP errors in console**
For React Router v7 / Next.js with strict CSP, add to your CSP allowlist:
- `script-src`: `https://*.posthog.com https://us-assets.i.posthog.com`
- `connect-src`: `https://*.posthog.com https://us.i.posthog.com`

The `react-router-v7.md` snippet shows the full CSP.
