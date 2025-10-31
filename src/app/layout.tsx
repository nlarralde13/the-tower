import type { Metadata } from "next";
import "../app/globals.css";

import Providers from "@/components/Providers";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = {
  title: "The Tower — Pocket Run Edition",
  description: "One-thumb tower crawler with mythic mood.",
  manifest: "/manifest.webmanifest",
  themeColor: "#0b0b11",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* These two lines are technically redundant since metadata covers them,
            but keeping them ensures compatibility with some browsers */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0b0b11" />
      </head>

      <body>
        {/* Accessibility helper */}
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>

        <Providers>
          <div className="app-shell">
            <TopBar />
            <main id="main-content" className="app-main" role="main">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
