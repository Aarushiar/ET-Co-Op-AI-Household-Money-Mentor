import { NextResponse } from "next/server";
import { clearAuthSessionCookie } from "@/src/lib/auth-session";

export async function POST() {
  const response = NextResponse.json({ authenticated: false }, { status: 200 });
  clearAuthSessionCookie(response);
  return response;
}
