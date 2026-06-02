# analytics-stack

[![npm version](https://img.shields.io/npm/v/analytics-stack?color=cb3837&logo=npm)](https://www.npmjs.com/package/analytics-stack) [![npm downloads](https://img.shields.io/npm/dt/analytics-stack?color=cb3837&logo=npm)](https://www.npmjs.com/package/analytics-stack) [![license](https://img.shields.io/npm/l/analytics-stack?color=blue)](./LICENSE)


> One command, three free analytics tools, full consent gating.
> **GA4 + Microsoft Clarity + PostHog** wired into any modern website.

```bash
npx analytics-stack init
```

Drops a privacy-first analytics setup into your project in under 30 seconds. Nothing loads until the visitor accepts the cookie banner. Each tool is independent — omit an env var to disable it.

---

## What you get

| Tool | Free tier | What it does |
|---|---|---|
| **Google Analytics 4** | Unlimited events, 14-month retention | Page views, events, attribution, real-time |
| **Microsoft Clarity** | Fully free, unlimited | Heatmaps, session recordings, rage-click detection |
| **PostHog** | 1M events/mo, 5K recordings/mo | Funnels, feature flags, cohorts, product analytics |

Plus:

- 🛡️ **Consent-gated** — zero network calls before the visitor clicks Accept
- 🪶 **Lazy-loaded PostHog SDK** — kept out of your initial bundle
- 🎨 **Themed cookie banner** — dark/light mode, accessible, responsive
- 🧭 **SPA route tracking** — page views fire on client-side navigation
- 🔌 **Framework-aware** — auto-detects Vite, Next.js, React Router v7, Remix, Astro
- 📦 **Zero runtime dependencies** — only adds `posthog-js` to your project

---

## Quick start

Inside any existing project:

```bash
# 1. Run the scaffolder
npx analytics-stack init

# 2. Sign up for the tools you want and grab the IDs:
#    - GA4:     https://analytics.google.com/
#    - Clarity: https://clarity.microsoft.com/
#    - PostHog: https://us.posthog.com/signup

# 3. Add the IDs to your .env file (the scaffolder added the var names already)

# 4. Mount the components in your app entry (the scaffolder printed a snippet)

# 5. Test in incognito → click Accept → check DevTools Network tab
```

That's it. The scaffolder takes care of:

- ✅ Creating `src/lib/analytics.js` (or `.ts`) — the wrapper module
- ✅ Creating `src/components/consent/CookieConsent.{jsx,tsx}` + CSS
- ✅ Patching `.env.example` with the right env var prefix for your framework
- ✅ Patching `.gitignore` to protect `.env`
- ✅ Running `pnpm add posthog-js` (or `npm`/`yarn`/`bun`)
- ✅ Printing the integration snippet for your framework

---

## Supported frameworks

| Framework | Auto-detect | Env prefix | Consent template | SSR-safe |
|---|---|---|---|---|
| Vite + React | ✅ | `VITE_` | React JSX/TSX | — |
| Next.js (App Router) | ✅ | `NEXT_PUBLIC_` | React JSX/TSX | ✅ |
| React Router v7 SSR | ✅ | `VITE_` | React JSX/TSX | ✅ |
| Remix | ✅ | (loader) | React JSX/TSX | ✅ |
| Astro | ✅ | `PUBLIC_` | `.astro` component | ✅ |
| Vanilla HTML/JS | manual | (hardcoded) | DOM-built banner | — |

---

## Architecture

### The wrapper (`src/lib/analytics.js`)

Five exported functions:

```js
import { hasConsented, initAnalytics, trackPageView, trackEvent, optOut } from "./lib/analytics";

hasConsented();                              // → boolean (reads localStorage)
await initAnalytics();                       // → injects GA4 + Clarity + PostHog scripts
trackPageView("/info");                      // → fires page_view in GA4 + $pageview in PostHog
trackEvent("cta_clicked", { label: "..." }); // → fires custom event in GA4 + PostHog
optOut();                                    // → disables all three on the current device
```

### The consent banner

`CookieConsent.jsx` shows a fixed-bottom banner on first visit. On Accept, it:

1. Sets `localStorage["cookie-consent"] = "accepted"`
2. Calls `initAnalytics()` (which actually injects the scripts)
3. Fires the first `trackPageView()`

On Decline, it sets `"declined"` and **never loads anything**.

### Consent-gating contract

The four invariants you must not break:

1. **Nothing loads before consent.** No `<script>` tags in `index.html`. All injection is runtime, post-accept.
2. **Each tool is independent.** Omit an env var → that tool no-ops, others still work.
3. **Idempotent init.** Calling `initAnalytics()` twice is a no-op.
4. **`hasConsented()` gates everything.** `trackPageView` and `trackEvent` short-circuit when consent is not granted.

If you change `analytics.js`, keep these invariants intact.

---

## Environment variables

The scaffolder writes the right prefix for your framework. For Vite + React:

```env
VITE_GA4_ID=G-XXXXXXXXXX
VITE_CLARITY_ID=xxxxxxxxxx
VITE_POSTHOG_KEY=phc_xxxxxxxxxxxx
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

For Next.js:

```env
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
NEXT_PUBLIC_CLARITY_ID=xxxxxxxxxx
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

For Astro:

```env
PUBLIC_GA4_ID=G-XXXXXXXXXX
PUBLIC_CLARITY_ID=xxxxxxxxxx
PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxx
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

For **production**, set the same vars in your hosting dashboard:

- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site configuration → Environment variables
- **Cloudflare Pages**: Settings → Environment variables

Then trigger a fresh deploy so the bundle picks them up.

---

## Detailed setup guides

- 📖 [GA4 setup](docs/ga4-setup.md) — how to create the property and get the Measurement ID
- 📖 [Microsoft Clarity setup](docs/clarity-setup.md) — how to find the Project ID
- 📖 [PostHog setup](docs/posthog-setup.md) — US vs EU cloud, API keys, projects
- 📖 [Consent gating explained](docs/consent-mode.md) — why we don't use Google Consent Mode v2
- 📖 [Installation walkthrough](docs/installation.md) — full step-by-step

---

## Commands

```bash
# Install into the current project
npx analytics-stack init

# Verify an existing installation
npx analytics-stack verify

# Show help
npx analytics-stack help
```

---

## Verification

After installing and adding IDs, run:

```bash
npx analytics-stack verify
```

It checks:

- ✔ `analytics.js` exists in the expected location
- ✔ It exports `hasConsented`, `initAnalytics`, `trackPageView`
- ✔ A consent banner component exists
- ✔ `.env.example` contains the right env var names
- ✔ `.gitignore` protects `.env`
- ✔ `posthog-js` is installed (if PostHog selected)

For **end-to-end** verification (real network requests):

1. `pnpm dev`
2. Open in incognito
3. Click **Accept** on the banner
4. DevTools → Network → filter by `google-analytics|clarity|posthog`
5. You should see one 204 from each tool you enabled

---

## FAQ

**Q: Why not use Google Tag Manager?**
GTM bundles ~40KB of runtime, requires a web UI to manage, and doesn't fit PostHog. This stack is direct integrations only — smaller, faster, and you own the code.

**Q: Why not use Google Consent Mode v2?**
Consent Mode v2 still loads gtag.js before consent (with restricted data). This stack is stricter: zero network calls until Accept. If you specifically need cookieless pings for declined users, switch to Consent Mode v2 — but that's not the default goal here.

**Q: Can I use only one tool?**
Yes. Omit the others' env vars. Each tool's init/track code is gated on the var being present. The bundle stays small.

**Q: Does it work with Server Components?**
The wrapper itself is SSR-safe (every entry guards `typeof window`). The consent banner is a Client Component. In Next.js App Router, mount it via a thin client wrapper — see `templates/snippets/nextjs.md`.

**Q: How do I track custom events?**
```js
import { trackEvent } from "./lib/analytics";
trackEvent("button_clicked", { label: "Hire Me", location: "hero" });
```
Fires in both GA4 (as a custom event) and PostHog (as `button_clicked`).

**Q: How do I add a new analytics tool later?**
Edit `analytics.js`. Add an `inject<Tool>()` function, call it from `initAnalytics()`, gate it on a new env var. Done — same pattern as the existing three.

---

## License

MIT © Vladyslav Didyk
