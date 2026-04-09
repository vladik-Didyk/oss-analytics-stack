# Microsoft Clarity setup

Clarity gives you **heatmaps + session recordings + rage-click detection** for free, with no usage limits.

## Create a project

1. Go to https://clarity.microsoft.com/
2. Sign in with Google, Microsoft, or Facebook
3. Click **+ New project**
4. **Name:** descriptive (e.g. `Personal Portfolio`)
5. **Website:** your URL (e.g. `https://yoursite.com`)
6. **Category:** pick the closest match
7. Click **Create**

## Get the Project ID

After creating the project:

1. Click **Settings** in the left sidebar
2. Click **Setup**
3. You'll see an **Install manually** option
4. The code snippet contains a 10-character ID near the end:

```html
<script type="text/javascript">
    (function(c,l,a,r,i,t,y){...})(window, document, "clarity", "script", "abcd1234ef");
</script>                                                                  ^^^^^^^^^^
                                                                           This is the Project ID
```

Copy **only the 10-character ID** (e.g. `abcd1234ef`) — not the whole script.

## Add to `.env`

```env
VITE_CLARITY_ID=abcd1234ef       # or NEXT_PUBLIC_CLARITY_ID, PUBLIC_CLARITY_ID, etc.
```

## Verify it's working

1. `pnpm dev`
2. Open in incognito → click **Accept**
3. DevTools → Network tab → filter by `clarity`
4. You should see `clarity.ms/tag/abcd1234ef` (200) and `z.clarity.ms/collect` (204)
5. Browse around for ~30 seconds, then close the tab

Clarity has a **~30 minute delay** before sessions appear in the dashboard. Check back later — you'll find your session under **Recordings** with a full mouse-trail replay.

## What you get

- **Recordings** — replay any visitor's session, watch their mouse and clicks
- **Heatmaps** — click maps and scroll maps per page
- **Insights** — auto-detected rage clicks, dead clicks, excessive scrolling, JavaScript errors
- **Filters** — segment recordings by device, browser, country, custom events

## Privacy

Clarity automatically masks form inputs, password fields, and any element with `data-clarity-mask="true"`. To mask additional elements:

```html
<div data-clarity-mask="true">Sensitive content</div>
```

## Free tier limits

- ✅ Unlimited sessions
- ✅ Unlimited heatmaps
- ✅ 1-year data retention
- ✅ Unlimited dashboards
- ❌ Microsoft owns and analyzes the data (use it if you're OK with that)

## Common issues

**Session recording is empty or shows no mouse movement**
Some browser extensions inject CSS that breaks Clarity's overlay. Test in a fresh incognito profile.

**Recordings take >30 min to appear**
Normal for the first few sessions on a brand new project. Subsequent sessions appear within 5–10 min.

**My country's privacy law requires explicit opt-in**
The analytics-stack consent banner already handles this — Clarity only loads after the user clicks Accept.
