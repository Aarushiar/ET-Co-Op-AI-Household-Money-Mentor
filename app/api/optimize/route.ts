import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getUnauthorizedResponse,
  isRequestAuthenticated,
} from "@/src/lib/auth-session";
import { runHouseholdOptimization } from "@/src/lib/tax-engine";
import { enforceRateLimit, getClientIdentifier } from "@/src/lib/rate-limit";
import type { OptimizationRequest } from "@/src/types/tax";

const riskProfileSchema = z.enum(["conservative", "moderate", "aggressive"]);
const liquidityNeedSchema = z.enum(["high", "medium", "low"]);

const partnerSchema = z.object({
  name: z.string().min(1),
  annualSalary: z.number().nonnegative(),
  annualRentPaid: z.number().nonnegative(),
  annualSipInvestment: z.number().nonnegative(),
  annualNpsContribution: z.number().nonnegative().optional(),
  annualHealthInsurancePremium: z.number().nonnegative().optional(),
  currentAssets: z.number().nonnegative().optional(),
  currentLiabilities: z.number().nonnegative().optional(),
  isMetroCity: z.boolean().optional(),
});

const preferencesSchema = z.object({
  riskProfile: riskProfileSchema,
  liquidityNeed: liquidityNeedSchema,
});

const lifeEventSchema = z.object({
  name: z.string().trim().min(1).max(80),
  yearsFromNow: z.number().int().min(0).max(40),
  oneTimeCost: z.number().nonnegative(),
  monthlyImpact: z.number().nonnegative(),
});

const optimizationRequestSchema = z.object({
  partners: z.array(partnerSchema).min(2).max(2),
  preferences: preferencesSchema.optional(),
  lifeEvents: z.array(lifeEventSchema).max(12).optional(),
});

export async function POST(request: Request) {
  try {
    if (!isRequestAuthenticated(request)) {
      return getUnauthorizedResponse();
    }

    const rateLimit = enforceRateLimit({
      bucket: "optimize",
      identifier: getClientIdentifier(request),
      maxRequests: 60,
      windowMs: 60000,
    });

    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Too many optimization requests. Please retry shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const json = (await request.json()) as unknown;
    const parsed = optimizationRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = runHouseholdOptimization(parsed.data as OptimizationRequest);
    return NextResponse.json(result, {
      status: 200,
      headers: {
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
