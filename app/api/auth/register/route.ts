import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAuthSessionCookie } from "@/src/lib/auth-session";
import { registerUser } from "@/src/lib/user-store";

const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = registerRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    if (parsed.data.password !== parsed.data.confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 },
      );
    }

    const normalizedEmail = parsed.data.email.toLowerCase();

    try {
      await registerUser(normalizedEmail, parsed.data.password);
    } catch (error) {
      if (error instanceof Error && error.message === "User already exists") {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 },
        );
      }
      throw error;
    }

    const response = NextResponse.json(
      { authenticated: true, userEmail: normalizedEmail },
      { status: 201 },
    );
    appendAuthSessionCookie(response, normalizedEmail);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
