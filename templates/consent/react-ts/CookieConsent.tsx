import { useEffect, useState } from "react";
import { initAnalytics, trackPageView, trackEvent } from "../../lib/analytics";
import "./cookieConsent.css";

const CONSENT_KEY = "cookie-consent";

export default function CookieConsent(): JSX.Element | null {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored) return;
    const t = setTimeout(() => setVisible(true), 700);
    return () => clearTimeout(t);
  }, []);

  async function accept(): Promise<void> {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
    await initAnalytics();
    trackPageView(window.location.pathname);
    trackEvent("cookie_consent_accepted");
  }

  function decline(): void {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-consent" role="dialog" aria-live="polite" aria-label="Cookie consent">
      <div className="cookie-consent__card">
        <p className="cookie-consent__text">
          This site uses cookies for analytics to understand how visitors interact with the
          content. Nothing loads until you accept.
        </p>
        <div className="cookie-consent__actions">
          <button
            type="button"
            className="cookie-consent__btn cookie-consent__btn--ghost"
            onClick={decline}
          >
            Decline
          </button>
          <button
            type="button"
            className="cookie-consent__btn cookie-consent__btn--primary"
            onClick={accept}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
