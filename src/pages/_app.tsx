// src/pages/_app.tsx
import { useEffect } from "react";                // React hook for side effects
import type { AppProps } from "next/app";        // Type hint for Next.js app props
import { validateRuleset } from "@/utils/validateRuleset";  // your validator

export default function App({ Component, pageProps }: AppProps) {
  // useEffect runs after the app loads in the browser
  useEffect(() => {
    // Only run validation when developing locally, not in production builds
    if (process.env.NODE_ENV === "development") {
      validateRuleset(); // triggers the validator once and logs results to console
    }
  }, []); // empty array = run once on mount

  // Render the normal app UI
  return <Component {...pageProps} />;
}
