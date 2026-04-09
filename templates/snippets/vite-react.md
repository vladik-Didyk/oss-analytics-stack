// src/App.jsx — add the AnalyticsTracker + CookieConsent

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import CookieConsent from "./components/consent/CookieConsent";
import { hasConsented, initAnalytics, trackPageView } from "./lib/analytics";

function AnalyticsTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (hasConsented()) {
      initAnalytics().then(() => trackPageView(pathname));
    }
  }, [pathname]);
  return null;
}

function App() {
  return (
    <>
      {/* …your existing app… */}
      <AnalyticsTracker />
      <CookieConsent />
    </>
  );
}

export default App;
