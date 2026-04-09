---
// src/layouts/Layout.astro — drop in CookieConsent
import CookieConsent from "../components/CookieConsent.astro";
---
<html lang="en">
  <head>
    <slot name="head" />
  </head>
  <body>
    <slot />
    <CookieConsent />
  </body>
</html>

<!-- The Astro CookieConsent component is self-contained: -->
<!-- it imports analytics.js, handles consent state, and shows the banner. -->
<!-- For client-side route tracking in a SPA-style Astro site, add: -->

<script>
  import { hasConsented, initAnalytics, trackPageView } from "../lib/analytics";
  document.addEventListener("astro:page-load", () => {
    if (hasConsented()) {
      initAnalytics().then(() => trackPageView(window.location.pathname));
    }
  });
</script>

<!-- NOTE: Astro env vars need PUBLIC_ prefix for client exposure. -->
<!-- Already configured in your .env.example. -->
