# Installation walkthrough

## 1. Run the scaffolder

From the **root of your existing project**:

```bash
npx analytics-stack init
```

The CLI will:

1. Auto-detect your framework (Vite, Next.js, React Router v7, Remix, Astro)
2. Auto-detect your package manager (pnpm, npm, yarn, bun)
3. Ask which analytics tools you want
4. Ask if you want TypeScript
5. Ask where to put the files (default `src/`)

You can hit Enter for every default if it auto-detected correctly.

## 2. Sign up for the analytics tools

Open these in three tabs:

| Tool | Signup URL | What you'll get |
|---|---|---|
| Google Analytics 4 | https://analytics.google.com/ | Measurement ID: `G-XXXXXXXXXX` |
| Microsoft Clarity | https://clarity.microsoft.com/ | Project ID: 10-character code |
| PostHog | https://us.posthog.com/signup | Project API Key: `phc_XXXXXXXX` |

Detailed walkthroughs:
- [GA4 setup →](./ga4-setup.md)
- [Clarity setup →](./clarity-setup.md)
- [PostHog setup →](./posthog-setup.md)

## 3. Add the IDs to `.env`

The scaffolder added the variable names to `.env.example` already. Copy them into `.env`:

```bash
cp .env.example .env
# then edit .env and paste your real IDs
```

For Vite (example):

```env
VITE_GA4_ID=G-43MSQLNW4M
VITE_CLARITY_ID=w8rnyl2ibr
VITE_POSTHOG_KEY=phc_xriFgTwsKbNRwDqrUhjRcE4biic3iHYqKb6v934qS69M
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

## 4. Mount the components

The scaffolder printed a snippet for your framework after running. If you missed it, see:

- [Vite + React snippet](../templates/snippets/vite-react.md)
- [Next.js snippet](../templates/snippets/nextjs.md)
- [React Router v7 snippet](../templates/snippets/react-router-v7.md)
- [Remix snippet](../templates/snippets/remix.md)
- [Astro snippet](../templates/snippets/astro.md)
- [Vanilla snippet](../templates/snippets/vanilla.md)

The pattern is always the same:

1. Import `CookieConsent` and the analytics helpers
2. Mount `<CookieConsent />` once at the root of your app
3. Add an `<AnalyticsTracker />` component that listens to route changes and calls `trackPageView()`

## 5. Test locally

```bash
pnpm dev
```

Open the dev URL in an **incognito window** (ad blockers in your normal browser will block GA4):

1. The cookie banner should appear after ~700ms
2. DevTools → Network tab → filter by `google` — should be **empty** before Accept
3. Click **Accept**
4. Network tab should now show:
   - `googletagmanager.com/gtag/js?id=G-XXXXXXXXXX`
   - `google-analytics.com/g/collect` → 204
   - `clarity.ms/collect` → 204
   - `us.i.posthog.com/e/` → 200
5. In GA4 → Reports → Realtime, you should see yourself within 30s

## 6. Verify the installation

```bash
npx analytics-stack verify
```

Reports any missing files, missing env vars, or broken expectations.

## 7. Deploy to production

The `.env` file is gitignored. You **must** set the env vars in your hosting dashboard:

- **Netlify**: Site configuration → Environment variables → add all four
- **Vercel**: Project Settings → Environment Variables → add all four
- **Cloudflare Pages**: Settings → Environment variables → add all four (Production scope)

Then trigger a fresh deploy. After deploy:

1. Open the live URL in incognito
2. Accept the banner
3. Check GA4 Realtime — you should see yourself
4. Check PostHog Live Events
5. Open Clarity dashboard the next day for session recordings (Clarity has ~30 min lag for first session)

## Troubleshooting

**Banner never appears**
You probably accepted/declined in a previous session. Open DevTools → Application → Local Storage → delete the `cookie-consent` key and refresh.

**GA4 Network tab is empty after Accept**
- Ad blocker enabled? Use strict incognito.
- Is `VITE_GA4_ID` set in `.env`? Restart the dev server after editing `.env`.
- React Router v7 / Next.js: did you extend the CSP? See `templates/snippets/react-router-v7.md`.

**GA4 dashboard says "No data received in past 48 hours"**
Normal — that page has a ~30 minute lag. Use **Reports → Realtime** to confirm data is flowing.

**PostHog requests fail with CORS**
Check `VITE_POSTHOG_HOST` matches your project region (US vs EU).

**The wrong env prefix was written**
The scaffolder picks the prefix based on detected framework. If detection is wrong, run `init` again and pick the framework manually.
