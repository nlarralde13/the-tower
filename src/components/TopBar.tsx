"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";

import CrtToggle from "@/components/CrtToggle";

const NAV_LINKS = [
  { href: "/", label: "Main Menu" },
  { href: "/climb", label: "Climb" },
  { href: "/traders", label: "Traders" },
  { href: "/crafters", label: "Crafters" },
  { href: "/inn", label: "Inn" },
  { href: "/training", label: "Training" },
  { href: "/play", label: "Play" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(href);
}

export default function TopBar() {
  const pathname = usePathname();
  const { status, data } = useSession();
  const name = data?.user?.name ?? "Seeker";
  const img = data?.user?.image ?? "";
  const initial = name?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="topbar">
      <div className="topbar__profile">
        {img ? (
          <img className="avatar" src={img} alt="" />
        ) : (
          <div className="avatar avatar--fallback">{initial}</div>
        )}
        <div className="who">
          {status === "authenticated" ? `Signed in as ${name}` : "Not signed in"}
        </div>
      </div>

      <nav className="topbar__nav" aria-label="Main navigation">
        {NAV_LINKS.map((link) => {
          const active = isActive(pathname ?? "/", link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`topbar__nav-link${active ? " topbar__nav-link--active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="topbar__controls">
        <CrtToggle />
        {status === "authenticated" ? (
          <button className="topbar__button" onClick={() => signOut()}>
            Sign out
          </button>
        ) : (
          <button className="topbar__button" onClick={() => signIn("google")}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
