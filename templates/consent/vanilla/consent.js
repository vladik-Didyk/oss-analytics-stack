// Vanilla JS consent banner — no framework dependencies, no innerHTML.
// Usage:
//   <link rel="stylesheet" href="/consent.css">
//   <script type="module" src="/consent.js"></script>
//
// Make sure analytics.js (sibling file) exports initAnalytics(), trackPageView(), trackEvent().

import { initAnalytics, trackPageView, trackEvent } from "./analytics.js";

const CONSENT_KEY = "cookie-consent";

function el(tag, className, attrs) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (attrs) {
    for (const k in attrs) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "data") {
        for (const dk in attrs.data) node.dataset[dk] = attrs.data[dk];
      } else node.setAttribute(k, attrs[k]);
    }
  }
  return node;
}

function buildBanner() {
  const wrap = el("div", "cookie-consent", {
    role: "dialog",
    "aria-label": "Cookie consent",
    "aria-live": "polite",
  });
  const card = el("div", "cookie-consent__card");
  const text = el("p", "cookie-consent__text", {
    text: "This site uses cookies for analytics to understand how visitors interact with the content. Nothing loads until you accept.",
  });
  const actions = el("div", "cookie-consent__actions");
  const decline = el("button", "cookie-consent__btn cookie-consent__btn--ghost", {
    type: "button",
    text: "Decline",
    data: { action: "decline" },
  });
  const accept = el("button", "cookie-consent__btn cookie-consent__btn--primary", {
    type: "button",
    text: "Accept",
    data: { action: "accept" },
  });

  accept.addEventListener("click", async () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    wrap.remove();
    await initAnalytics();
    trackPageView(window.location.pathname);
    trackEvent("cookie_consent_accepted");
  });

  decline.addEventListener("click", () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    wrap.remove();
  });

  actions.appendChild(decline);
  actions.appendChild(accept);
  card.appendChild(text);
  card.appendChild(actions);
  wrap.appendChild(card);
  return wrap;
}

function init() {
  if (typeof window === "undefined") return;

  // Returning visitor with prior consent → init silently
  if (localStorage.getItem(CONSENT_KEY) === "accepted") {
    initAnalytics().then(() => trackPageView(window.location.pathname));
    return;
  }

  // First visit (or declined) → show banner only if no decision yet
  if (localStorage.getItem(CONSENT_KEY)) return;

  // Wait 700ms so the banner doesn't fight with first paint
  setTimeout(() => {
    document.body.appendChild(buildBanner());
  }, 700);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
