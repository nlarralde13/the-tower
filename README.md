This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Epic 1 — Retro Look & TopBar

The “Thumb UX & Mobile Flow” epic introduces a static retro treatment and persistent accessibility preferences:

- A transparent scanline overlay is expected at `/public/overlays/scanlines.png` and is always mounted once at the root. The repository does not track the bitmap so the element simply fades in/out when the asset is provided downstream.
- The soft retro filter is a class-based wrapper that applies `contrast(1.07)` and `brightness(0.97)` plus a fixed vignette. Both modes honour `prefers-reduced-motion`.
- Preferences persist to `localStorage` under `pref:retro`, `pref:hc`, `pref:textlg`, and `pref:haptics`. They hydrate through a shared `PreferencesProvider` that updates `<html>` attributes for `[data-hc]` and `[data-bigtext]`.
- The refreshed TopBar keeps a 64px touch target, centres the identity block, and exposes Settings and Sign in/out actions with accessible focus states.
- Page backgrounds are supplied per route through `<PageSurface backgroundImage="/backgrounds/..." />`, layered with a static gradient and grain for a stable, non-jitter look. As with the overlay, ship the background bitmaps out-of-band under `/public/backgrounds/`.
- PWA icons are referenced from `/public/icons/icon-192.png` and `/public/icons/icon-512.png`. Provide production-ready PNGs outside of this repository to avoid large binary diffs in pull requests.

Visit `/settings` to toggle retro modes, high contrast, large text, and future haptics support.
