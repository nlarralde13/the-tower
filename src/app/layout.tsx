import type { ReactNode } from "react";
import "../app/globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "The Tower — Pocket Run Edition",
  description: "One-thumb tower crawler.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
