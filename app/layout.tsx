import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { TTSProvider } from "@/lib/tts";
import { AccessibilityProvider } from "@/components/AccessibilityProvider";
import AssistantWidget from "@/components/AssistantWidget";
import { SignLanguageProvider, SignLanguageWidget } from "@/components/SignLanguageProvider";

// The MOEI design system's two typefaces, self-hosted via next/font and exposed as the
// CSS variables (--font-jakarta / --font-plex-ar) that globals.css maps --font / --font-ar to.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-ar",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SADDAD | نظام إعادة جدولة متأخرات السكن",
  description: "SADDAD — AI-powered housing arrears rescheduling platform by the UAE Ministry of Energy and Infrastructure",
};

// Explicit mobile viewport so the layout scales correctly on phones (the design system in
// globals.css is now fully responsive). viewportFit:'cover' lets us use the safe-area insets
// on notched devices; the page stays user-scalable for accessibility (no maximumScale lock).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${plexArabic.variable}`}>
      <body suppressHydrationWarning>
        <TTSProvider>
          <AccessibilityProvider>
            <SignLanguageProvider>
              {/* #a11y-root carries the accessibility CSS filter (saturate/colour-blind) and
                  zoom. A filter creates a containing block, which would trap position:fixed
                  descendants — so the floating widgets live OUTSIDE it (still inside the
                  providers) to stay pinned to the viewport while the page scrolls. */}
              <div id="a11y-root">{children}</div>
              <SignLanguageWidget />
              <AssistantWidget />
            </SignLanguageProvider>
          </AccessibilityProvider>
        </TTSProvider>
      </body>
    </html>
  );
}
