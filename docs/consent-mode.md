# Consent gating explained

This doc explains the design decision behind how analytics-stack handles consent.

## TL;DR

**analytics-stack uses lazy script injection** — no analytics code loads until the user clicks Accept. This is stricter than Google Consent Mode v2 and gives you the strongest privacy story.

## How it works

### Step 1: Page loads

The user visits your site. The HTML loads. **Zero** analytics requests have been made:

- No `gtag.js` script tag in `<head>`
- No `clarity.ms` script tag
- No PostHog SDK in the bundle

The bundle includes only **your code** — the wrapper module (`analytics.js`) and the consent banner (`CookieConsent.jsx`). Both are tiny.

### Step 2: Consent banner appears

After ~700ms (so it doesn't fight with first paint), the cookie banner fades in.

It's a fixed-bottom card with two buttons: **Decline** and **Accept**.

The banner has a `localStorage` check — if the user already accepted/declined in a previous session, the banner doesn't appear at all.

### Step 3: User clicks Accept

`CookieConsent.jsx` handler:

1. Sets `localStorage["cookie-consent"] = "accepted"`
2. Hides the banner
3. Calls `await initAnalytics()` from `analytics.js`

`initAnalytics()` does three things:

1. **GA4**: Creates a `<script async src="googletagmanager.com/gtag/js?id=...">` and appends it to `<head>`. Initializes `window.gtag` with `send_page_view: false` (we handle SPA route tracking manually).
2. **Clarity**: Runs the official Clarity bootstrap snippet, which appends its own `<script>` tag for `clarity.ms/tag/...`.
3. **PostHog**: Dynamically `await import("posthog-js")` — this is the **first time** the SDK enters the JavaScript bundle. Calls `posthog.init()` with `capture_pageview: false`.

After init, `trackPageView(window.location.pathname)` fires the first page view.

### Step 4: User clicks Decline

`CookieConsent.jsx` handler:

1. Sets `localStorage["cookie-consent"] = "declined"`
2. Hides the banner

**That's it.** No scripts load, no requests fire, no SDK enters the bundle. `hasConsented()` returns `false` forever, so any subsequent calls to `trackPageView()` or `trackEvent()` are no-ops.

### Step 5: Returning visitor

On the next page load, the `AnalyticsTracker` component (mounted by you in your app entry) checks `hasConsented()` on mount:

- **If `"accepted"`**: calls `initAnalytics()` immediately and fires a `trackPageView`. Banner does not appear.
- **If `"declined"`**: nothing loads, banner does not appear.
- **If `null`** (first visit): banner appears.

## Why not Google Consent Mode v2?

Google Consent Mode v2 is Google's official approach for handling consent. The pattern:

1. Load `gtag.js` immediately on every page
2. Set default consent state to `"denied"`
3. After consent, call `gtag('consent', 'update', { analytics_storage: 'granted' })`

**Tradeoffs vs analytics-stack:**

| Aspect | Consent Mode v2 | analytics-stack |
|---|---|---|
| Network calls before consent | Yes (cookieless pings) | **None** |
| `gtag.js` in initial bundle | Yes | **No** |
| Clarity supported | No (own SDK) | **Yes** |
| PostHog supported | No (own SDK) | **Yes** |
| Implementation complexity | High (Google docs) | Low |
| Privacy posture | Permissive | **Strict** |

Consent Mode v2 is the right choice if:
- You only use Google products (GA4 + Ads)
- You need cookieless modeling for declined users
- You're running paid Google Ads campaigns and need conversion modeling

analytics-stack is the right choice if:
- You use multiple analytics tools (GA4 + Clarity + PostHog)
- You want zero network calls before consent
- You want a small, readable wrapper you fully control

## Why localStorage and not cookies?

`cookie-consent` is stored in `localStorage`, not a cookie. Reasons:

- localStorage is per-origin, never sent in HTTP requests → no accidental leakage
- No cookie banner-about-the-cookie-banner paradox
- Survives across sessions on the same device
- Easy to clear during testing (DevTools → Application → Local Storage)

The name `cookie-consent` is purely a label — it doesn't actually use cookies for consent storage.

## Why a 700ms delay before showing the banner?

Three reasons:

1. **Avoids flash of unstyled content** — gives stylesheets time to load before the banner pops in
2. **Plays nicely with route reveal animations** — if your app fades content in, the banner doesn't fight for attention
3. **Reduces banner blindness** — if a user is mid-scroll when it appears, they're more likely to actually read it

You can change the delay in `CookieConsent.jsx` line ~14: `setTimeout(() => setVisible(true), 700)`.

## Edge cases handled

| Scenario | Behavior |
|---|---|
| User declines, then changes mind | Manually clear `localStorage["cookie-consent"]` (no UI for this — add one if you want) |
| User accepts on Page A, navigates to Page B | `AnalyticsTracker` re-inits on the new pathname; second `initAnalytics()` is a no-op |
| User accepts, then ad blocker eats the request | `gtag.js` script load fails silently — no events sent. No fallback. |
| User has Do Not Track enabled | We **do not** auto-decline based on DNT. The user must explicitly click Decline. (DNT is widely ignored by industry; we leave it as a deliberate user action.) |
| Network is offline | `initAnalytics()` runs, scripts fail to load. Subsequent track calls queue in `dataLayer` (GA4) and `posthog.q` (PostHog) — they flush when network returns. |
| User clears localStorage manually | Banner reappears on next visit. Clean slate. |

## Adding more consent categories

The current banner is binary: accept all, or decline all. If you need GDPR-compliant per-category consent (statistics / marketing / preferences), you'll need to extend `CookieConsent.jsx`:

1. Add checkboxes for each category
2. Store an object instead of a string in localStorage:
   ```js
   localStorage.setItem("cookie-consent", JSON.stringify({
     analytics: true,
     marketing: false,
     functional: true,
   }));
   ```
3. Update `hasConsented()` to take a category arg
4. Gate each tool: GA4 = analytics, Clarity = analytics, PostHog = analytics + marketing

This is left as an exercise — the current binary model fits 90% of use cases.
