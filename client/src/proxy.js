import { NextResponse } from "next/server";

const normalizeRole = (role) => String(role || "").trim();

const getRoleFromPath = (pathname) => {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/hod")) return "hod";
  if (pathname.startsWith("/staff")) return "staff";
  if (pathname.startsWith("/student")) return "student";
  return null;
};

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const requiredRole = getRoleFromPath(pathname);

  if (!requiredRole) {
    return NextResponse.next();
  }

  const cookie = request.headers.get("cookie") || "";

  if (!cookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const response = await fetch(`${backendUrl}/auth/verify-me`, {
      method: "GET",
      headers: { Cookie: cookie },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const user = await response.json();
    const role = normalizeRole(user?.role).toLowerCase();

    if (!role) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const canonicalUserRole = role === "hod" ? "hod" : role;
    const canonicalRequiredRole = requiredRole;

    if (canonicalUserRole !== canonicalRequiredRole) {
      return NextResponse.redirect(new URL(`/${canonicalUserRole}`, request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error("PROXY ERROR:", error);
    return NextResponse.redirect(new URL("/", request.url));
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/hod/:path*",
    "/staff/:path*",
    "/student/:path*",
  ],
};