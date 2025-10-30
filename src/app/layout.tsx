import type { Metadata } from "next";
import "../app/globals.css";

import Providers from "@/components/Providers";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = {
  title: "The Tower — Pocket Run Edition",
  description: "One-thumb tower crawler.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
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
