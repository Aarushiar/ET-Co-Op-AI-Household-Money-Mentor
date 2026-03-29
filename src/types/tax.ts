export type TaxRegime = "old" | "new";

export type PartnerTaxInput = {
	name: string;
	annualSalary: number;
	annualRentPaid: number;
	annualSipInvestment: number;
	annualNpsContribution?: number;
	annualHealthInsurancePremium?: number;
	currentAssets?: number;
	currentLiabilities?: number;
	isMetroCity?: boolean;
};

export type RiskProfile = "conservative" | "moderate" | "aggressive";

export type LiquidityNeed = "high" | "medium" | "low";

export type HouseholdPreferences = {
	riskProfile: RiskProfile;
	liquidityNeed: LiquidityNeed;
};

export type FireProjection = {
	annualExpenseEstimate: number;
	currentNetWorth: number;
	targetCorpus: number;
	gapToFire: number;
	estimatedYearsToFire: number;
	assumedAnnualReturnRate: number;
	annualInvestibleSurplus: number;
};

export type FinancialHealthScore = {
	score: number;
	band: "excellent" | "good" | "fair" | "at-risk";
	breakdown: {
		taxEfficiency: number;
		protection: number;
		leverage: number;
		savingsDiscipline: number;
	};
};

export type LifeEventScenario = {
	name: string;
	yearsFromNow: number;
	oneTimeCost: number;
	monthlyImpact: number;
	projectedAdditionalNeed: number;
	note: string;
};

export type MutualFundXRay = {
	sipToIncomeRatio: number;
	equityTilt: "high" | "balanced" | "low";
	taxSaverAllocationHint: string;
	rebalancingAction: string;
};

export type LifeEventInput = {
	name: string;
	yearsFromNow: number;
	oneTimeCost: number;
	monthlyImpact: number;
};

export type OptimizationRequest = {
	partners: PartnerTaxInput[];
	preferences?: HouseholdPreferences;
	lifeEvents?: LifeEventInput[];
};

export type PartnerTaxResult = {
	partnerName: string;
	oldRegimeTaxCurrent: number;
	oldRegimeTaxOptimized: number;
	newRegimeTax: number;
	currentBestTax: number;
	optimizedBestTax: number;
	currentBestRegime: TaxRegime;
	optimizedBestRegime: TaxRegime;
	leakageAmount: number;
	npsTaxBenefitPotential: number;
	deductions: {
		standardDeduction: number;
		section80CCurrent: number;
		section80COptimized: number;
		section80CCD1BCurrent: number;
		section80CCD1BOptimized: number;
		section80DCurrent: number;
		section80DOptimized: number;
		hraExemptionCurrent: number;
		hraExemptionOptimized: number;
	};
	suggestions: string[];
};

export type HouseholdOptimizationResult = {
	preferences: HouseholdPreferences;
	household: {
		totalIncome: number;
		totalRent: number;
		totalSip: number;
		totalNps: number;
		totalInsurancePremium: number;
		totalAssets: number;
		totalLiabilities: number;
		totalNetWorth: number;
		totalCurrentBestTax: number;
		totalOptimizedBestTax: number;
		leakageDetected: number;
		oldRegimeCombinedTaxCurrent: number;
		oldRegimeCombinedTaxOptimized: number;
		newRegimeCombinedTax: number;
		recommendedCurrentRegime: TaxRegime;
		recommendedOptimizedRegime: TaxRegime;
	};
	partnerResults: PartnerTaxResult[];
	coupleOptimizationInsights: string[];
	optimizationSuggestions: string[];
	advancedModules: {
		fireProjection: FireProjection;
		healthScore: FinancialHealthScore;
		lifeEventSimulator: LifeEventScenario[];
		mutualFundXRay: MutualFundXRay;
	};
	rankedTaxSavingInvestments: Array<{
		name: string;
		applicableSection: "80C" | "80CCD(1B)" | "80D" | "planning";
		risk: RiskProfile;
		liquidity: LiquidityNeed;
		recommendedAnnualAmount: number;
		priorityScore: number;
		rationale: string;
	}>;
	assumptions: string[];
};

export type HrEmailDraft = {
	partnerName: string;
	subject: string;
	body: string;
};

export type AiMentorRequest = {
	optimizationRequest: OptimizationRequest;
};

export type AiMentorResponse = {
	plainEnglishSummary: string;
	householdNarrative: string;
	keyMoves: string[];
	hrEmailDrafts: HrEmailDraft[];
	generatedBy: "openai" | "fallback";
};

export type EmailExecutionItem = {
	partnerName: string;
	to: string | null;
	status: "sent" | "failed" | "skipped";
	provider: "resend" | "fallback";
	id?: string;
	error?: string;
};

export type EmailExecutionSummary = {
	mode: "sent" | "draft-only";
	provider: "resend" | "fallback";
	summary: string;
	results: EmailExecutionItem[];
};

export type ExecuteFixesResponse = {
	aiMentor: AiMentorResponse;
	emailExecution: EmailExecutionSummary;
};

export type ExecuteFixesRequest = {
	optimizationRequest: OptimizationRequest;
	recipientOverrides?: Record<string, string>;
};
