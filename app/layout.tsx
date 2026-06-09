import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { TTSProvider } from "@/lib/tts";
import { AccessibilityProvider } from "@/components/AccessibilityProvider";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${plexArabic.variable}`}>
      <body>
        <TTSProvider>
          <AccessibilityProvider>
            <div id="a11y-root">{children}</div>
          </AccessibilityProvider>
        </TTSProvider>
      </body>
    </html>
  );
}
