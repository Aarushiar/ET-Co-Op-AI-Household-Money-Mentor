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
    remaining: 19,
    resetAt: Date.now() + 60_000,
    retryAfterSeconds: 60,
  })),
  getClientIdentifier: vi.fn(() => "test-client"),
}));

vi.mock("@/src/lib/ai", () => ({
  generateAiMentorResponse: vi.fn(async () => ({
    plainEnglishSummary: "Summary",
    householdNarrative: "Narrative",
    keyMoves: ["Move 1", "Move 2", "Move 3"],
    hrEmailDrafts: [
      { partnerName: "Partner A", subject: "Subject A", body: "Body A" },
      { partnerName: "Partner B", subject: "Subject B", body: "Body B" },
    ],
    generatedBy: "fallback",
  })),
}));

import { POST } from "@/app/api/ai-mentor/route";
import { isRequestAuthenticated } from "@/src/lib/auth-session";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import { generateAiMentorResponse } from "@/src/lib/ai";

const basePayload = {
  optimizationRequest: {
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
        name: "Career break",
        yearsFromNow: 2,
        oneTimeCost: 300000,
        monthlyImpact: 25000,
      },
    ],
  },
};

describe("POST /api/ai-mentor", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(isRequestAuthenticated).mockReturnValue(true);
    vi.mocked(enforceRateLimit).mockReturnValue({
      ok: true,
      remaining: 19,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
    });
  });

  it("returns 401 when request is unauthenticated", async () => {
    vi.mocked(isRequestAuthenticated).mockReturnValue(false);

    const request = new Request("http://localhost/api/ai-mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basePayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns AI mentor response for valid payload", async () => {
    const request = new Request("http://localhost/api/ai-mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basePayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = (await response.json()) as {
      plainEnglishSummary: string;
      keyMoves: string[];
    };

    expect(data.plainEnglishSummary).toBe("Summary");
    expect(data.keyMoves.length).toBeGreaterThan(0);
    expect(generateAiMentorResponse).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid life-event payload", async () => {
    const invalidPayload = {
      ...basePayload,
      optimizationRequest: {
        ...basePayload.optimizationRequest,
        lifeEvents: [
          {
            ...basePayload.optimizationRequest.lifeEvents[0],
            name: "",
          },
        ],
      },
    };

    const request = new Request("http://localhost/api/ai-mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(generateAiMentorResponse).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(enforceRateLimit).mockReturnValue({
      ok: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
    });

    const request = new Request("http://localhost/api/ai-mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basePayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
  });
});
