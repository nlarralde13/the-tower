import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_ROUTES = ["/climb", "/play", "/traders", "/crafters", "/inn", "/training"] as const;

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) {
    return NextResponse.next();
  }

  const signInUrl = new URL("/", request.url);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/climb/:path*",
    "/play/:path*",
    "/traders/:path*",
    "/crafters/:path*",
    "/inn/:path*",
    "/training/:path*",
  ],
};
