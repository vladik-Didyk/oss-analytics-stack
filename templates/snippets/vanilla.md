<!-- index.html — add to <head> -->
<link rel="stylesheet" href="/consent.css">

<!-- index.html — add before closing </body> -->
<script type="module" src="/consent.js"></script>

<!-- consent.js auto-imports ./analytics.js (sibling file). -->
<!-- Make sure both consent.js and analytics.js are served at the same root path. -->

<!-- IMPORTANT: vanilla HTML has no env var system. -->
<!-- You must edit src/lib/analytics.js manually and replace: -->
<!--   import.meta.env.VITE_GA4_ID  →  "G-XXXXXXXXXX"  (your real ID) -->
<!--   import.meta.env.VITE_CLARITY_ID  →  "xxxxxxxxxx" -->
<!--   import.meta.env.VITE_POSTHOG_KEY  →  "phc_xxxxx" -->
<!-- OR replace those lookups with a config object loaded from a JSON file. -->
