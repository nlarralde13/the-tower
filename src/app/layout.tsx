import "../app/globals.css";
import Providers from "@/components/Providers";

import TopBar from "@/components/TopBar";

export const metadata = {
  title: "The Tower — Pocket Run Edition",
  description: "One-thumb tower crawler.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="crt">
      <body>
        <Providers>
          <div className="app-shell">
            <TopBar />
            <div className="app-main">{children}</div>
          </div>
          
        </Providers>
      </body>
    </html>
  );
}
