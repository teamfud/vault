import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: pages and actions verify the session against the DB.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("vault_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  // d/ is the cookie-free public download route. api/artifacts is skipped
  // because the proxy truncates request bodies over 10MB, which breaks uploads.
  // Both check access and set no-store themselves.
  matcher: ["/((?!login|api/health|api/artifacts|d/|_next/static|_next/image|icon.png|apple-icon.png|teamfud.png).*)"],
};
