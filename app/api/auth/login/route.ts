import { NextResponse } from "next/server";
import { z } from "zod";
import {
  appendAuthSessionCookie,
} from "@/src/lib/auth-session";
import { verifyUserCredentials } from "@/src/lib/user-store";

const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = loginRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const isValidUser = await verifyUserCredentials(
      parsed.data.email,
      parsed.data.password,
    );

    if (!isValidUser) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const response = NextResponse.json(
      { authenticated: true, userEmail: parsed.data.email.toLowerCase() },
      { status: 200 },
    );
    appendAuthSessionCookie(response, parsed.data.email.toLowerCase());
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
