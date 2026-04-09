// Lightweight analytics wrapper for GA4, Microsoft Clarity, and PostHog.
// All three are consent-gated — nothing loads until initAnalytics() is called,
// which only happens after the user accepts the cookie banner.
// Each tool is independent: omit its env var to disable it.

// BEGIN GA4
const GA4_ID = import.meta.env.__ENV_PREFIX__GA4_ID;
// END GA4
// BEGIN CLARITY
const CLARITY_ID = import.meta.env.__ENV_PREFIX__CLARITY_ID;
// END CLARITY
// BEGIN POSTHOG
const POSTHOG_KEY = import.meta.env.__ENV_PREFIX__POSTHOG_KEY;
const POSTHOG_HOST =
  import.meta.env.__ENV_PREFIX__POSTHOG_HOST || "https://us.i.posthog.com";
// END POSTHOG

const CONSENT_KEY = "cookie-consent";

let initialized = false;
let posthogInstance = null;

export function hasConsented() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CONSENT_KEY) === "accepted";
}

// BEGIN GA4
function injectGA4() {
  if (!GA4_ID) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  // send_page_view: false — we fire page views manually so SPA route changes get counted
  window.gtag("config", GA4_ID, { send_page_view: false });

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(s);
}
// END GA4

// BEGIN CLARITY
function injectClarity() {
  if (!CLARITY_ID) return;
  // Microsoft Clarity official bootstrap snippet.
  (function (c, l, a, r, i, t, y) {
    c[a] =
      c[a] ||
      function () {
        (c[a].q = c[a].q || []).push(arguments);
      };
    t = l.createElement(r);
    t.async = 1;
    t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0];
    y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_ID);
}
// END CLARITY

// BEGIN POSTHOG
async function initPostHog() {
  if (!POSTHOG_KEY) return;
  // Dynamic import keeps posthog-js out of the initial bundle when consent is declined.
  const mod = await import("posthog-js");
  const posthog = mod.default;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // handled manually in trackPageView
    persistence: "localStorage+cookie",
  });
  posthogInstance = posthog;
}
// END POSTHOG

export async function initAnalytics() {
  if (initialized) return;
  if (typeof window === "undefined") return;
  initialized = true;
  // BEGIN GA4
  injectGA4();
  // END GA4
  // BEGIN CLARITY
  injectClarity();
  // END CLARITY
  // BEGIN POSTHOG
  await initPostHog();
  // END POSTHOG
}

export function trackPageView(path) {
  if (typeof window === "undefined") return;
  if (!hasConsented()) return;
  // BEGIN GA4
  if (GA4_ID && window.gtag) {
    window.gtag("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }
  // END GA4
  // BEGIN POSTHOG
  if (posthogInstance) {
    posthogInstance.capture("$pageview", { $current_url: window.location.href });
  }
  // END POSTHOG
}

export function trackEvent(name, props = {}) {
  if (typeof window === "undefined") return;
  if (!hasConsented()) return;
  // BEGIN GA4
  if (GA4_ID && window.gtag) window.gtag("event", name, props);
  // END GA4
  // BEGIN POSTHOG
  if (posthogInstance) posthogInstance.capture(name, props);
  // END POSTHOG
}

export function optOut() {
  if (typeof window === "undefined") return;
  // BEGIN GA4
  if (GA4_ID) window[`ga-disable-${GA4_ID}`] = true;
  // END GA4
  // BEGIN POSTHOG
  if (posthogInstance) posthogInstance.opt_out_capturing();
  // END POSTHOG
}
