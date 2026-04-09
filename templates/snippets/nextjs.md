// app/layout.tsx (App Router) — wrap children with the analytics components

import CookieConsent from "@/components/consent/CookieConsent";
import AnalyticsProvider from "@/components/consent/AnalyticsProvider";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AnalyticsProvider>{children}</AnalyticsProvider>
        <CookieConsent />
      </body>
    </html>
  );
}

// src/components/consent/AnalyticsProvider.tsx — create this client component

"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { hasConsented, initAnalytics, trackPageView } from "@/lib/analytics";

export default function AnalyticsProvider({ children }) {
  const pathname = usePathname();
  useEffect(() => {
    if (hasConsented()) {
      initAnalytics().then(() => trackPageView(pathname));
    }
  }, [pathname]);
  return children;
}

// NOTE: Next.js requires NEXT_PUBLIC_ prefix for client-side env vars.
// Already configured in your .env.example.
