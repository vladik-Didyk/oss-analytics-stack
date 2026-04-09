// SSR-safe analytics wrapper for GA4, Microsoft Clarity, and PostHog.
// All three are consent-gated — nothing loads until initAnalytics() is called.
// Every entry point is guarded with `typeof window === "undefined"` so this
// module is safe to import on the server (Next.js, React Router v7, Remix, Astro).

// Note: __ENV_PREFIX__ is replaced by the CLI based on framework detection.
// For Next.js: NEXT_PUBLIC_  •  Vite/RR7: VITE_  •  Astro: PUBLIC_

// BEGIN GA4
const GA4_ID =
  (typeof process !== "undefined" && process.env && process.env.__ENV_PREFIX__GA4_ID) ||
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.__ENV_PREFIX__GA4_ID);
// END GA4
// BEGIN CLARITY
const CLARITY_ID =
  (typeof process !== "undefined" && process.env && process.env.__ENV_PREFIX__CLARITY_ID) ||
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.__ENV_PREFIX__CLARITY_ID);
// END CLARITY
// BEGIN POSTHOG
const POSTHOG_KEY =
  (typeof process !== "undefined" && process.env && process.env.__ENV_PREFIX__POSTHOG_KEY) ||
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.__ENV_PREFIX__POSTHOG_KEY);
const POSTHOG_HOST =
  (typeof process !== "undefined" && process.env && process.env.__ENV_PREFIX__POSTHOG_HOST) ||
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.__ENV_PREFIX__POSTHOG_HOST) ||
  "https://us.i.posthog.com";
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
  if (typeof window === "undefined") return;
  if (!GA4_ID) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA4_ID, { send_page_view: false });

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(s);
}
// END GA4

// BEGIN CLARITY
function injectClarity() {
  if (typeof window === "undefined") return;
  if (!CLARITY_ID) return;
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
  if (typeof window === "undefined") return;
  if (!POSTHOG_KEY) return;
  // Dynamic import keeps posthog-js out of the SSR bundle.
  const mod = await import("posthog-js");
  const posthog = mod.default;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    persistence: "localStorage+cookie",
  });
  posthogInstance = posthog;
}
// END POSTHOG

export async function initAnalytics() {
  if (typeof window === "undefined") return;
  if (initialized) return;
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
