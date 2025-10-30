"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, data } = useSession();

  if (status === "loading") {
    return (
      <div className="screen center">
        <div className="loader">Waking the Tower…</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="screen center">
        <h1 className="logo">THE TOWER</h1>
        <p className="tag">A polite little nightmare.</p>

        <button
          className="btn primary"
          onClick={() => signIn("google")}
        >
          Sign in with Google
        </button>

        <div className="divider">Or continue with</div>

        <div className="idp-row">
          <button className="btn idp" onClick={() => signIn("github")}>
            GitHub
          </button>
          <button className="btn idp" onClick={() => signIn("discord")}>
            Discord
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="topbar">
        <span className="user">Welcome, {data?.user?.name ?? "Seeker"}</span>
        <button className="link" onClick={() => signOut()}>
          Sign out
        </button>
      </header>
      {children}
    </div>
  );
}
