import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/src/lib/auth-session", () => ({
  isRequestAuthenticated: vi.fn(),
  getUnauthorizedResponse: vi.fn(() =>
    Response.json(
      { error: "Unauthorized. Please log in to continue." },
      { status: 401 },
    ),
  ),
}));

vi.mock("@/src/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(() => ({
    ok: true,
    remaining: 59,
    resetAt: Date.now() + 60_000,
    retryAfterSeconds: 60,
  })),
  getClientIdentifier: vi.fn(() => "test-client"),
}));

import { POST } from "@/app/api/optimize/route";
import { isRequestAuthenticated } from "@/src/lib/auth-session";
import { enforceRateLimit } from "@/src/lib/rate-limit";

const basePayload = {
  partners: [
    {
      name: "Partner A",
      annualSalary: 1800000,
      annualRentPaid: 300000,
      annualSipInvestment: 240000,
      annualNpsContribution: 20000,
      annualHealthInsurancePremium: 12000,
      currentAssets: 2200000,
      currentLiabilities: 600000,
      isMetroCity: true,
    },
    {
      name: "Partner B",
      annualSalary: 1200000,
      annualRentPaid: 240000,
      annualSipInvestment: 180000,
      annualNpsContribution: 10000,
      annualHealthInsurancePremium: 10000,
      currentAssets: 1800000,
      currentLiabilities: 450000,
      isMetroCity: true,
    },
  ],
  preferences: {
    riskProfile: "moderate" as const,
    liquidityNeed: "medium" as const,
  },
  lifeEvents: [
    {
      name: "Custom Event",
      yearsFromNow: 3,
      oneTimeCost: 900000,
      monthlyImpact: 20000,
    },
  ],
};

describe("POST /api/optimize", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(isRequestAuthenticated).mockReturnValue(true);
    vi.mocked(enforceRateLimit).mockReturnValue({
      ok: true,
      remaining: 59,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
    });
  });

  it("returns 401 when request is unauthenticated", async () => {
    vi.mocked(isRequestAuthenticated).mockReturnValue(false);

    const request = new Request("http://localhost/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basePayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns optimized result including advanced modules for valid payload", async () => {
    const request = new Request("http://localhost/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basePayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = (await response.json()) as {
      advancedModules: {
        lifeEventSimulator: Array<{ name: string }>;
        fireProjection: { targetCorpus: number };
        healthScore: { score: number };
      };
    };

    expect(data.advancedModules.fireProjection.targetCorpus).toBeGreaterThan(0);
    expect(data.advancedModules.healthScore.score).toBeGreaterThanOrEqual(0);
    expect(data.advancedModules.lifeEventSimulator[0]?.name).toContain("Custom Event");
  });

  it("returns 400 for invalid life-event payload", async () => {
    const invalidPayload = {
      ...basePayload,
      lifeEvents: [
        {
          ...basePayload.lifeEvents[0],
          yearsFromNow: -1,
        },
      ],
    };

    const request = new Request("http://localhost/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(enforceRateLimit).mockReturnValue({
      ok: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
    });

    const request = new Request("http://localhost/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basePayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
  });
});
