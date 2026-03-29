import { describe, expect, it } from "vitest";
import { runHouseholdOptimization } from "@/src/lib/tax-engine";

describe("runHouseholdOptimization", () => {
  it("returns net worth and investment ranking for a valid couple payload", () => {
    const result = runHouseholdOptimization({
      partners: [
        {
          name: "Partner A",
          annualSalary: 1800000,
          annualRentPaid: 300000,
          annualSipInvestment: 100000,
          annualNpsContribution: 10000,
          annualHealthInsurancePremium: 10000,
          currentAssets: 2400000,
          currentLiabilities: 700000,
          isMetroCity: true,
        },
        {
          name: "Partner B",
          annualSalary: 1200000,
          annualRentPaid: 240000,
          annualSipInvestment: 80000,
          annualNpsContribution: 5000,
          annualHealthInsurancePremium: 8000,
          currentAssets: 1800000,
          currentLiabilities: 500000,
          isMetroCity: true,
        },
      ],
      preferences: {
        riskProfile: "moderate",
        liquidityNeed: "medium",
      },
      lifeEvents: [
        {
          name: "Custom Life Event",
          yearsFromNow: 3,
          oneTimeCost: 800000,
          monthlyImpact: 20000,
        },
      ],
    });

    expect(result.household.totalNetWorth).toBe(3000000);
    expect(result.household.totalInsurancePremium).toBe(18000);
    expect(result.coupleOptimizationInsights.length).toBeGreaterThan(0);
    expect(result.rankedTaxSavingInvestments.length).toBeGreaterThan(0);
    expect(result.advancedModules.fireProjection.targetCorpus).toBeGreaterThan(0);
    expect(result.advancedModules.healthScore.score).toBeGreaterThanOrEqual(0);
    expect(result.advancedModules.healthScore.score).toBeLessThanOrEqual(100);
    expect(result.advancedModules.lifeEventSimulator.length).toBeGreaterThan(0);
    expect(result.advancedModules.lifeEventSimulator[0]?.name).toContain("Custom Life Event");
    expect(result.advancedModules.mutualFundXRay.sipToIncomeRatio).toBeGreaterThan(0);
  });

  it("includes NPS recommendation when 80CCD(1B) capacity is underused", () => {
    const result = runHouseholdOptimization({
      partners: [
        {
          name: "Partner A",
          annualSalary: 2500000,
          annualRentPaid: 100000,
          annualSipInvestment: 150000,
          annualNpsContribution: 0,
          annualHealthInsurancePremium: 5000,
          currentAssets: 1000000,
          currentLiabilities: 300000,
          isMetroCity: true,
        },
        {
          name: "Partner B",
          annualSalary: 2000000,
          annualRentPaid: 100000,
          annualSipInvestment: 150000,
          annualNpsContribution: 0,
          annualHealthInsurancePremium: 5000,
          currentAssets: 900000,
          currentLiabilities: 200000,
          isMetroCity: true,
        },
      ],
      preferences: {
        riskProfile: "moderate",
        liquidityNeed: "low",
      },
    });

    const npsItem = result.rankedTaxSavingInvestments.find(
      (item) => item.applicableSection === "80CCD(1B)",
    );

    expect(npsItem).toBeDefined();
    expect(npsItem?.recommendedAnnualAmount).toBeGreaterThan(0);
    expect(
      result.partnerResults.some((partner) => partner.npsTaxBenefitPotential > 0),
    ).toBe(true);
    expect(result.advancedModules.healthScore.breakdown.taxEfficiency).toBeLessThanOrEqual(100);
  });
});
