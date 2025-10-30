// middleware.ts
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/" },
});

export const config = {
  matcher: ["/climb/:path*", "/traders/:path*", "/crafters/:path*", "/inn/:path*", "/training/:path*"],
};
