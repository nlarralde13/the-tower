import "../app/globals.css";
import Providers from "@/components/Providers";
import CrtOverlay from "@/components/CrtOverlay";

export const metadata = {
  title: "The Tower — Pocket Run Edition",
  description: "One-thumb tower crawler.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="crt">
      <body>
        <Providers>
          {children}
          <CrtOverlay />
        </Providers>
      </body>
    </html>
  );
}
