type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type EnforceRateLimitArgs = {
  bucket: string;
  identifier: string;
  maxRequests: number;
  windowMs: number;
};

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

function getStoreKey(bucket: string, identifier: string): string {
  return `${bucket}:${identifier}`;
}

export function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "local-client";
}

export function enforceRateLimit(args: EnforceRateLimitArgs): RateLimitResult {
  const now = Date.now();
  const storeKey = getStoreKey(args.bucket, args.identifier);
  const existing = rateLimitStore.get(storeKey);

  let current: RateLimitEntry;
  if (!existing || existing.resetAt <= now) {
    current = {
      count: 0,
      resetAt: now + args.windowMs,
    };
  } else {
    current = existing;
  }

  current.count += 1;
  rateLimitStore.set(storeKey, current);

  const remaining = Math.max(0, args.maxRequests - current.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));

  return {
    ok: current.count <= args.maxRequests,
    remaining,
    resetAt: current.resetAt,
    retryAfterSeconds,
  };
}
