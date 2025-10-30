"use client";
import { useSession, signIn, signOut } from "next-auth/react";

export default function TopBar() {
  const { status, data } = useSession();
  const name = data?.user?.name ?? "Seeker";
  const img = data?.user?.image ?? "";
  const initial = name?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="topbar">
      <div className="userbox">
        {img ? (
          <img className="avatar" src={img} alt="" />
        ) : (
          <div className="avatar avatar--fallback">{initial}</div>
        )}
        <div className="who">
          {status === "authenticated" ? `Signed in as ${name}` : "Not signed in"}
        </div>
      </div>
      {status === "authenticated" ? (
        <button className="link" onClick={() => signOut()}>
          Sign out
        </button>
      ) : (
        <button className="link" onClick={() => signIn("google")}>
          Sign in
        </button>
      )}
    </header>
  );
}
