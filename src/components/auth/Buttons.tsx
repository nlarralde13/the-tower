"use client";

import { signIn, signOut } from "next-auth/react";

export function SignInButton({ className = "" }: { className?: string }) {
  return (
    <button
      className={`rounded-2xl px-5 py-3 text-base font-semibold bg-amber-600 hover:bg-amber-500 active:scale-[0.99] ${className}`}
      onClick={() => signIn("google")}
    >
      Sign in with Google
    </button>
  );
}

export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <button
      className={`rounded-2xl px-4 py-2 text-sm border border-white/10 hover:bg-white/10 ${className}`}
      onClick={() => signOut()}
    >
      Sign out
    </button>
  );
}
