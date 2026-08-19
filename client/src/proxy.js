import { NextResponse } from "next/server";

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  let requiredRole = null;

  if (pathname.startsWith("/admin")) {
    requiredRole = "admin";
  } else if (pathname.startsWith("/hod")) {
    requiredRole = "hod";
  } else if (pathname.startsWith("/staff")) {
    requiredRole = "staff";
  } else if (pathname.startsWith("/student")) {
    requiredRole = "student";
  }

  if (!requiredRole) {
    return NextResponse.next();
  }

  

  const cookie = request.headers.get("cookie") || "";

  

  if (!cookie) {
    return NextResponse.redirect(
      new URL("/", request.url)
    );
  }

  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

   

    const response = await fetch(
      `${backendUrl}/auth/verify-me`,
      {
        method: "GET",
        headers: {
          Cookie: cookie,
        },
        cache: "no-store",
      }
    );

    console.log("BACKEND STATUS:", response.status);

    if (!response.ok) {
      console.log("AUTHENTICATION FAILED");

      return NextResponse.redirect(
        new URL("/", request.url)
      );
    }

    const user = await response.json();

    

    const role = user.role?.toLowerCase();

    if (!role) {
      return NextResponse.redirect(
        new URL("/", request.url)
      );
    }

    

    // User is trying to access another role's section
    if (role !== requiredRole) {
      console.log(
        `ACCESS DENIED: ${role} -> ${requiredRole}`
      );

      return NextResponse.redirect(
        new URL(`/${role}`, request.url)
      );
    }

    console.log("ACCESS GRANTED");

    return NextResponse.next();

  } catch (error) {
    console.error("PROXY ERROR:", error);

    return NextResponse.redirect(
      new URL("/", request.url)
    );
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