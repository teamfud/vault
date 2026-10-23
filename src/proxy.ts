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
  matcher: ["/((?!login|api/health|_next/static|_next/image|icon.png|apple-icon.png|teamfud.png).*)"],
};
