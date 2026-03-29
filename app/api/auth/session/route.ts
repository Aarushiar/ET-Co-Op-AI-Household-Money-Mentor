import { NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/src/lib/auth-session";

export async function GET(request: Request) {
  const userEmail = getAuthenticatedUserFromRequest(request);

  return NextResponse.json(
    {
      authenticated: Boolean(userEmail),
      userEmail,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
