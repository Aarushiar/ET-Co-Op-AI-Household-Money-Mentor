import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "et_coop_session";
const DEFAULT_AUTH_SECRET = "local-dev-session-secret";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getAuthSecret(): string {
  return process.env.AUTH_SESSION_SECRET ?? DEFAULT_AUTH_SECRET;
}

function signPayload(payload: string): string {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex <= 0) {
        return acc;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      if (key) {
        acc[key] = decodeURIComponent(value);
      }
      return acc;
    }, {});
}

function getSessionTokenFromRequest(request: Request): string | null {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  return cookies[AUTH_COOKIE_NAME] ?? null;
}

function createSessionToken(userEmail: string): string {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const encodedEmail = Buffer.from(userEmail, "utf8").toString("base64url");
  const payload = `${expiresAt}:${encodedEmail}:${randomUUID()}`;
  const signature = signPayload(payload);
  return `${payload}:${signature}`;
}

function verifySessionToken(token: string): string | null {
  const parts = token.split(":");
  if (parts.length !== 4) {
    return null;
  }

  const [expiresAtRaw, encodedEmail, nonce, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  const payload = `${expiresAtRaw}:${encodedEmail}:${nonce}`;
  const expectedSignature = signPayload(payload);
  if (!constantTimeEquals(expectedSignature, signature)) {
    return null;
  }

  try {
    const userEmail = Buffer.from(encodedEmail, "base64url").toString("utf8");
    return userEmail || null;
  } catch {
    return null;
  }
}

export function isRequestAuthenticated(request: Request): boolean {
  return Boolean(getAuthenticatedUserFromRequest(request));
}

export function getAuthenticatedUserFromRequest(request: Request): string | null {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export function appendAuthSessionCookie(
  response: NextResponse,
  userEmail: string,
): NextResponse {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: createSessionToken(userEmail),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}

export function clearAuthSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export function getUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized. Please log in to continue." },
    { status: 401 },
  );
}
