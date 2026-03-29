import type {
	HouseholdPreferences,
	HouseholdOptimizationResult,
	LifeEventInput,
	LiquidityNeed,
	OptimizationRequest,
	PartnerTaxInput,
	PartnerTaxResult,
	RiskProfile,
	TaxRegime,
} from "@/src/types/tax";

const STANDARD_DEDUCTION = 50000;
const SECTION_80C_CAP = 150000;
const SECTION_80CCD1B_CAP = 50000;
const SECTION_80D_CAP = 25000;
const CESS_RATE = 0.04;
const FIRE_SAFE_WITHDRAWAL_RATE = 0.04;
const FIRE_ANNUAL_CONTRIBUTION_STEP_UP_RATE = 0.05;
const BASE_INFLATION_RATE = 0.06;
const MAX_FIRE_PROJECTION_YEARS = 40;
const TARGET_SAVINGS_RATE = 0.35;

type Slab = {
	upTo: number;
	rate: number;
};

const OLD_REGIME_SLABS: Slab[] = [
	{ upTo: 250000, rate: 0 },
	{ upTo: 500000, rate: 0.05 },
	{ upTo: 1000000, rate: 0.2 },
	{ upTo: Number.POSITIVE_INFINITY, rate: 0.3 },
];

const NEW_REGIME_SLABS: Slab[] = [
	{ upTo: 300000, rate: 0 },
	{ upTo: 700000, rate: 0.05 },
	{ upTo: 1000000, rate: 0.1 },
	{ upTo: 1200000, rate: 0.15 },
	{ upTo: 1500000, rate: 0.2 },
	{ upTo: Number.POSITIVE_INFINITY, rate: 0.3 },
];

const inrFormatter = new Intl.NumberFormat("en-IN");

const defaultPreferences: HouseholdPreferences = {
	riskProfile: "moderate",
	liquidityNeed: "medium",
};

function toCurrencyNumber(value: number): number {
	if (!Number.isFinite(value) || value < 0) {
		return 0;
	}
	return Math.round(value);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function formatInr(value: number): string {
	return `Rs ${inrFormatter.format(toCurrencyNumber(value))}`;
}

function calculateTaxFromSlabs(taxableIncome: number, slabs: Slab[]): number {
	let tax = 0;
	let lowerLimit = 0;

	for (const slab of slabs) {
		if (taxableIncome <= lowerLimit) {
			break;
		}

		const taxableInSlab = Math.min(taxableIncome, slab.upTo) - lowerLimit;
		tax += taxableInSlab * slab.rate;
		lowerLimit = slab.upTo;
	}

	return toCurrencyNumber(tax);
}

function applyRebate(baseTax: number, taxableIncome: number, regime: TaxRegime): number {
	if (regime === "old" && taxableIncome <= 500000) {
		return Math.max(0, baseTax - 12500);
	}

	if (regime === "new" && taxableIncome <= 700000) {
		return Math.max(0, baseTax - 25000);
	}

	return baseTax;
}

function addCess(baseTax: number): number {
	return toCurrencyNumber(baseTax * (1 + CESS_RATE));
}

function calculateHraExemption(
	annualSalary: number,
	annualRentPaid: number,
	isMetroCity: boolean,
): number {
	const basicSalary = annualSalary * 0.4;
	const hraReceived = basicSalary * 0.5;
	const rentMinusTenPercentBasic = Math.max(0, annualRentPaid - basicSalary * 0.1);
	const percentOfBasic = basicSalary * (isMetroCity ? 0.5 : 0.4);

	return toCurrencyNumber(
		Math.min(hraReceived, rentMinusTenPercentBasic, percentOfBasic),
	);
}

function calculateOldRegimeTax(args: {
	annualSalary: number;
	hraExemption: number;
	section80C: number;
	section80CCD1B: number;
	section80D: number;
}): number {
	const taxableIncome = Math.max(
		0,
		args.annualSalary -
			STANDARD_DEDUCTION -
			args.hraExemption -
			args.section80C -
			args.section80CCD1B -
			args.section80D,
	);

	const baseTax = calculateTaxFromSlabs(taxableIncome, OLD_REGIME_SLABS);
	const postRebate = applyRebate(baseTax, taxableIncome, "old");
	return addCess(postRebate);
}

function calculateNewRegimeTax(annualSalary: number): number {
	const taxableIncome = Math.max(0, annualSalary - STANDARD_DEDUCTION);
	const baseTax = calculateTaxFromSlabs(taxableIncome, NEW_REGIME_SLABS);
	const postRebate = applyRebate(baseTax, taxableIncome, "new");
	return addCess(postRebate);
}

function getBestRegimeTax(oldTax: number, newTax: number): {
	regime: TaxRegime;
	tax: number;
} {
	if (oldTax <= newTax) {
		return { regime: "old", tax: oldTax };
	}

	return { regime: "new", tax: newTax };
}

function getPreferenceScore<T extends string>(
	preference: T,
	actual: T,
	orderedValues: readonly T[],
): number {
	if (preference === actual) {
		return 3;
	}

	const prefIndex = orderedValues.indexOf(preference);
	const actualIndex = orderedValues.indexOf(actual);
	if (prefIndex < 0 || actualIndex < 0) {
		return 1;
	}

	return Math.abs(prefIndex - actualIndex) === 1 ? 2 : 1;
}

function getAssumedAnnualReturnRate(riskProfile: RiskProfile): number {
	if (riskProfile === "conservative") {
		return 0.08;
	}

	if (riskProfile === "aggressive") {
		return 0.12;
	}

	return 0.1;
}

function getInflationRate(riskProfile: RiskProfile): number {
	if (riskProfile === "conservative") {
		return BASE_INFLATION_RATE - 0.005;
	}

	if (riskProfile === "aggressive") {
		return BASE_INFLATION_RATE + 0.005;
	}

	return BASE_INFLATION_RATE;
}

function toRealReturnRate(nominalReturnRate: number, inflationRate: number): number {
	const realReturnRate = (1 + nominalReturnRate) / (1 + inflationRate) - 1;
	return Math.max(0.01, realReturnRate);
}

function estimateYearsToTarget(args: {
	currentCorpus: number;
	targetCorpus: number;
	annualContribution: number;
	annualReturnRate: number;
	annualContributionStepUpRate: number;
}): number {
	let corpus = Math.max(0, toCurrencyNumber(args.currentCorpus));
	let annualContribution = Math.max(0, toCurrencyNumber(args.annualContribution));
	const target = Math.max(0, toCurrencyNumber(args.targetCorpus));

	if (target <= corpus) {
		return 0;
	}

	if (annualContribution <= 0) {
		return MAX_FIRE_PROJECTION_YEARS;
	}

	for (let year = 1; year <= MAX_FIRE_PROJECTION_YEARS; year += 1) {
		corpus = toCurrencyNumber(corpus * (1 + args.annualReturnRate) + annualContribution);
		if (corpus >= target) {
			return year;
		}

		annualContribution = toCurrencyNumber(
			annualContribution * (1 + args.annualContributionStepUpRate),
		);
	}

	return MAX_FIRE_PROJECTION_YEARS;
}

function buildFinancialHealthScore(args: {
	totalIncome: number;
	totalSip: number;
	totalNps: number;
	totalInsurancePremium: number;
	totalAssets: number;
	totalLiabilities: number;
	totalNetWorth: number;
	annualExpenseEstimate: number;
	leakageDetected: number;
	totalCurrentBestTax: number;
}): HouseholdOptimizationResult["advancedModules"]["healthScore"] {
	const taxEfficiency =
		args.totalCurrentBestTax > 0
			? clamp(
					100 -
						Math.round((args.leakageDetected / args.totalCurrentBestTax) * 120),
					0,
					100,
				)
			: 100;

	const insuranceTarget = Math.max(
		50000,
		toCurrencyNumber(args.totalIncome * 0.025),
		toCurrencyNumber(args.annualExpenseEstimate * 0.12),
	);
	const protection =
		insuranceTarget > 0
			? clamp(
					Math.round((args.totalInsurancePremium / insuranceTarget) * 100),
					0,
					100,
				)
			: 0;

	const debtToAssetRatio =
		args.totalAssets > 0 ? args.totalLiabilities / args.totalAssets : 1;
	const netWorthCoverageYears =
		args.annualExpenseEstimate > 0
			? args.totalNetWorth / args.annualExpenseEstimate
			: 0;
	const coverageScore = clamp(Math.round((netWorthCoverageYears / 12) * 100), 0, 100);
	const leverage = clamp(
		Math.round((1 - debtToAssetRatio) * 70 + coverageScore * 0.3),
		0,
		100,
	);

	const savingsRate =
		args.totalIncome > 0 ? (args.totalSip + args.totalNps) / args.totalIncome : 0;
	const savingsDiscipline = clamp(
		Math.round((savingsRate / TARGET_SAVINGS_RATE) * 100),
		0,
		100,
	);

	const score = toCurrencyNumber(
		taxEfficiency * 0.3 +
			protection * 0.25 +
			leverage * 0.2 +
			savingsDiscipline * 0.25,
	);

	const band: HouseholdOptimizationResult["advancedModules"]["healthScore"]["band"] =
		score >= 82 ? "excellent" : score >= 68 ? "good" : score >= 52 ? "fair" : "at-risk";

	return {
		score,
		band,
		breakdown: {
			taxEfficiency,
			protection,
			leverage,
			savingsDiscipline,
		},
	};
}

function buildLifeEventSimulator(args: {
	totalIncome: number;
	annualExpenseEstimate: number;
	fireGap: number;
	lifeEvents?: LifeEventInput[];
	inflationRate: number;
}): HouseholdOptimizationResult["advancedModules"]["lifeEventSimulator"] {
	const defaultEvents: LifeEventInput[] = [
		{
			name: "Home Upgrade Down Payment",
			yearsFromNow: 2,
			oneTimeCost: toCurrencyNumber(args.totalIncome * 0.4),
			monthlyImpact: 0,
		},
		{
			name: "Childcare + Schooling Kickoff",
			yearsFromNow: 4,
			oneTimeCost: toCurrencyNumber(args.totalIncome * 0.2),
			monthlyImpact: toCurrencyNumber(args.totalIncome * 0.03),
		},
		{
			name: "Career Break Emergency Buffer",
			yearsFromNow: 1,
			oneTimeCost: toCurrencyNumber(args.annualExpenseEstimate * 0.6),
			monthlyImpact: toCurrencyNumber(args.annualExpenseEstimate / 12),
		},
	];

	const sourceEvents = args.lifeEvents?.length ? args.lifeEvents : defaultEvents;

	return sourceEvents.map((event, index) => {
		const yearsFromNow = clamp(Math.round(event.yearsFromNow), 0, 40);
		const baseOneTimeCost = toCurrencyNumber(event.oneTimeCost);
		const baseMonthlyImpact = toCurrencyNumber(event.monthlyImpact);
		const inflationMultiplier = Math.pow(1 + args.inflationRate, yearsFromNow);

		const oneTimeCost = toCurrencyNumber(baseOneTimeCost * inflationMultiplier);
		const monthlyImpact = toCurrencyNumber(baseMonthlyImpact * inflationMultiplier);
		const recurringYearOneImpact = toCurrencyNumber(monthlyImpact * 12);
		const projectedAdditionalNeed = toCurrencyNumber(
			Math.max(0, args.fireGap + oneTimeCost + recurringYearOneImpact),
		);

		const normalizedName = event.name.trim();
		const name = normalizedName.length ? normalizedName : `Life Event ${index + 1}`;

		return {
			name,
			yearsFromNow,
			oneTimeCost,
			monthlyImpact,
			projectedAdditionalNeed,
			note:
				yearsFromNow > 0
					? `Inflation-adjusted at ${(args.inflationRate * 100).toFixed(1)}% annual inflation over ${yearsFromNow} year(s).`
					: "Current-year estimate; keep this funded in near-term liquidity buckets.",
		};
	});
}

function buildMutualFundXRay(args: {
	totalIncome: number;
	totalSip: number;
	preferences: HouseholdPreferences;
}): HouseholdOptimizationResult["advancedModules"]["mutualFundXRay"] {
	const sipToIncomeRatio =
		args.totalIncome > 0 ? clamp((args.totalSip / args.totalIncome) * 100, 0, 100) : 0;

	const equityTilt: HouseholdOptimizationResult["advancedModules"]["mutualFundXRay"]["equityTilt"] =
		args.preferences.riskProfile === "aggressive"
			? "high"
			: args.preferences.riskProfile === "conservative"
				? "low"
				: "balanced";

	const taxSaverAllocationHint =
		sipToIncomeRatio < 12
			? "Increase ELSS-oriented SIP contribution to improve both 80C usage and equity growth." 
			: "Current SIP base is healthy; prioritize fund quality and cost efficiency over frequent churn.";

	const rebalancingAction =
		args.preferences.liquidityNeed === "high"
			? "Shift 10-20% new SIP flow to short-duration debt or arbitrage funds for near-term liquidity." 
			: "Maintain equity core and rebalance annually around your target asset allocation band.";

	return {
		sipToIncomeRatio: toCurrencyNumber(sipToIncomeRatio),
		equityTilt,
		taxSaverAllocationHint,
		rebalancingAction,
	};
}

function buildRankedTaxSavingInvestments(args: {
	preferences: HouseholdPreferences;
	total80CGap: number;
	totalNpsGap: number;
	total80DGap: number;
}): HouseholdOptimizationResult["rankedTaxSavingInvestments"] {
	const riskOrder: readonly RiskProfile[] = ["conservative", "moderate", "aggressive"];
	const liquidityOrder: readonly LiquidityNeed[] = ["low", "medium", "high"];

	const candidates: Array<{
		name: string;
		applicableSection: "80C" | "80CCD(1B)" | "80D" | "planning";
		risk: RiskProfile;
		liquidity: LiquidityNeed;
		recommendedAnnualAmount: number;
		rationale: string;
		sectionGap: number;
	}> = [
		{
			name: "NPS Tier-I Contribution",
			applicableSection: "80CCD(1B)",
			risk: "moderate",
			liquidity: "low",
			recommendedAnnualAmount: args.totalNpsGap,
			rationale:
				"Best for additional tax deduction beyond 80C while improving retirement corpus.",
			sectionGap: args.totalNpsGap,
		},
		{
			name: "ELSS Tax Saver Funds",
			applicableSection: "80C",
			risk: "aggressive",
			liquidity: "medium",
			recommendedAnnualAmount: Math.min(args.total80CGap, 100000),
			rationale: "Higher growth potential with shortest 80C lock-in window (3 years).",
			sectionGap: args.total80CGap,
		},
		{
			name: "PPF Contribution",
			applicableSection: "80C",
			risk: "conservative",
			liquidity: "low",
			recommendedAnnualAmount: Math.min(args.total80CGap, 150000),
			rationale: "Stable sovereign-backed compounding for low-risk households.",
			sectionGap: args.total80CGap,
		},
		{
			name: "Tax Saver FD",
			applicableSection: "80C",
			risk: "conservative",
			liquidity: "low",
			recommendedAnnualAmount: Math.min(args.total80CGap, 75000),
			rationale: "Simple bank product for predictable returns with 80C claim.",
			sectionGap: args.total80CGap,
		},
		{
			name: "Health Insurance Top-up",
			applicableSection: "80D",
			risk: "conservative",
			liquidity: "high",
			recommendedAnnualAmount: args.total80DGap,
			rationale:
				"Covers medical risk while directly improving 80D utilization for both partners.",
			sectionGap: args.total80DGap,
		},
	];

	return candidates
		.filter((candidate) => candidate.recommendedAnnualAmount > 0)
		.map((candidate) => {
			const riskScore = getPreferenceScore(
				args.preferences.riskProfile,
				candidate.risk,
				riskOrder,
			);
			const liquidityScore = getPreferenceScore(
				args.preferences.liquidityNeed,
				candidate.liquidity,
				liquidityOrder,
			);
			const sectionGapScore = Math.min(4, Math.round(candidate.sectionGap / 50000));

			return {
				name: candidate.name,
				applicableSection: candidate.applicableSection,
				risk: candidate.risk,
				liquidity: candidate.liquidity,
				recommendedAnnualAmount: toCurrencyNumber(candidate.recommendedAnnualAmount),
				priorityScore: riskScore * 2 + liquidityScore * 2 + sectionGapScore,
				rationale: candidate.rationale,
			};
		})
		.sort((a, b) => b.priorityScore - a.priorityScore);
}

function evaluatePartner(partner: PartnerTaxInput): PartnerTaxResult {
	const annualSalary = toCurrencyNumber(partner.annualSalary);
	const annualRentPaid = toCurrencyNumber(partner.annualRentPaid);
	const annualSipInvestment = toCurrencyNumber(partner.annualSipInvestment);
	const annualNpsContribution = toCurrencyNumber(partner.annualNpsContribution ?? 0);
	const annualHealthInsurancePremium = toCurrencyNumber(
		partner.annualHealthInsurancePremium ?? 0,
	);
	const isMetroCity = partner.isMetroCity ?? true;

	const section80CCurrent = Math.min(annualSipInvestment, SECTION_80C_CAP);
	const section80CCD1BCurrent = Math.min(annualNpsContribution, SECTION_80CCD1B_CAP);
	const section80DCurrent = Math.min(annualHealthInsurancePremium, SECTION_80D_CAP);
	const hraExemptionCurrent = 0;

	const section80COptimized = SECTION_80C_CAP;
	const section80CCD1BOptimized = SECTION_80CCD1B_CAP;
	const section80DOptimized = SECTION_80D_CAP;
	const hraExemptionOptimized = calculateHraExemption(
		annualSalary,
		annualRentPaid,
		isMetroCity,
	);

	const oldRegimeTaxCurrent = calculateOldRegimeTax({
		annualSalary,
		hraExemption: hraExemptionCurrent,
		section80C: section80CCurrent,
		section80CCD1B: section80CCD1BCurrent,
		section80D: section80DCurrent,
	});

	const oldRegimeTaxNpsOnlyOptimized = calculateOldRegimeTax({
		annualSalary,
		hraExemption: hraExemptionCurrent,
		section80C: section80CCurrent,
		section80CCD1B: section80CCD1BOptimized,
		section80D: section80DCurrent,
	});

	const npsTaxBenefitPotential = Math.max(
		0,
		oldRegimeTaxCurrent - oldRegimeTaxNpsOnlyOptimized,
	);

	const oldRegimeTaxOptimized = calculateOldRegimeTax({
		annualSalary,
		hraExemption: hraExemptionOptimized,
		section80C: section80COptimized,
		section80CCD1B: section80CCD1BOptimized,
		section80D: section80DOptimized,
	});

	const newRegimeTax = calculateNewRegimeTax(annualSalary);

	const currentBest = getBestRegimeTax(oldRegimeTaxCurrent, newRegimeTax);
	const optimizedBest = getBestRegimeTax(oldRegimeTaxOptimized, newRegimeTax);

	const leakageAmount = Math.max(0, currentBest.tax - optimizedBest.tax);

	const suggestions: string[] = [];

	if (optimizedBest.regime === "old" && currentBest.regime === "new") {
		suggestions.push(
			`${partner.name}: Shift to old regime after deductions to save ${formatInr(leakageAmount)}.`,
		);
	}

	if (hraExemptionOptimized > 0) {
		suggestions.push(
			`${partner.name}: Claim HRA exemption up to ${formatInr(hraExemptionOptimized)} under old regime.`,
		);
	}

	if (section80CCurrent < SECTION_80C_CAP) {
		suggestions.push(
			`${partner.name}: Increase 80C-eligible investments by ${formatInr(
				SECTION_80C_CAP - section80CCurrent,
			)} to hit the 80C cap.`,
		);
	}

	if (section80DCurrent < SECTION_80D_CAP) {
		suggestions.push(
			`${partner.name}: Add health insurance premium up to ${formatInr(
				SECTION_80D_CAP - section80DCurrent,
			)} for 80D benefits.`,
		);
	}

	if (section80CCD1BCurrent < SECTION_80CCD1B_CAP) {
		suggestions.push(
			`${partner.name}: Top up NPS by ${formatInr(
				SECTION_80CCD1B_CAP - section80CCD1BCurrent,
			)} for additional 80CCD(1B) tax benefit.`,
		);
	}

	if (leakageAmount === 0) {
		suggestions.push(
			`${partner.name}: Current regime choice is already near-optimal for the given inputs.`,
		);
	}

	return {
		partnerName: partner.name,
		oldRegimeTaxCurrent,
		oldRegimeTaxOptimized,
		newRegimeTax,
		currentBestTax: currentBest.tax,
		optimizedBestTax: optimizedBest.tax,
		currentBestRegime: currentBest.regime,
		optimizedBestRegime: optimizedBest.regime,
		leakageAmount,
		npsTaxBenefitPotential,
		deductions: {
			standardDeduction: STANDARD_DEDUCTION,
			section80CCurrent,
			section80COptimized,
			section80CCD1BCurrent,
			section80CCD1BOptimized,
			section80DCurrent,
			section80DOptimized,
			hraExemptionCurrent,
			hraExemptionOptimized,
		},
		suggestions,
	};
}

export function runHouseholdOptimization(
	request: OptimizationRequest,
): HouseholdOptimizationResult {
	if (!request.partners?.length) {
		throw new Error("At least one partner input is required.");
	}

	const preferences = request.preferences ?? defaultPreferences;

	const partnerResults = request.partners.map(evaluatePartner);

	const totalIncome = request.partners.reduce(
		(sum, partner) => sum + toCurrencyNumber(partner.annualSalary),
		0,
	);
	const totalRent = request.partners.reduce(
		(sum, partner) => sum + toCurrencyNumber(partner.annualRentPaid),
		0,
	);
	const totalSip = request.partners.reduce(
		(sum, partner) => sum + toCurrencyNumber(partner.annualSipInvestment),
		0,
	);
	const totalNps = request.partners.reduce(
		(sum, partner) => sum + toCurrencyNumber(partner.annualNpsContribution ?? 0),
		0,
	);
	const totalInsurancePremium = request.partners.reduce(
		(sum, partner) => sum + toCurrencyNumber(partner.annualHealthInsurancePremium ?? 0),
		0,
	);
	const totalAssets = request.partners.reduce(
		(sum, partner) => sum + toCurrencyNumber(partner.currentAssets ?? 0),
		0,
	);
	const totalLiabilities = request.partners.reduce(
		(sum, partner) => sum + toCurrencyNumber(partner.currentLiabilities ?? 0),
		0,
	);
	const totalNetWorth = Math.max(0, totalAssets - totalLiabilities);

	const oldRegimeCombinedTaxCurrent = partnerResults.reduce(
		(sum, partner) => sum + partner.oldRegimeTaxCurrent,
		0,
	);
	const oldRegimeCombinedTaxOptimized = partnerResults.reduce(
		(sum, partner) => sum + partner.oldRegimeTaxOptimized,
		0,
	);
	const newRegimeCombinedTax = partnerResults.reduce(
		(sum, partner) => sum + partner.newRegimeTax,
		0,
	);

	const totalCurrentBestTax = partnerResults.reduce(
		(sum, partner) => sum + partner.currentBestTax,
		0,
	);
	const totalOptimizedBestTax = partnerResults.reduce(
		(sum, partner) => sum + partner.optimizedBestTax,
		0,
	);

	const leakageDetected = Math.max(0, totalCurrentBestTax - totalOptimizedBestTax);

	const recommendedCurrentRegime: TaxRegime =
		oldRegimeCombinedTaxCurrent <= newRegimeCombinedTax ? "old" : "new";
	const recommendedOptimizedRegime: TaxRegime =
		oldRegimeCombinedTaxOptimized <= newRegimeCombinedTax ? "old" : "new";

	const optimizationSuggestions = Array.from(
		new Set(partnerResults.flatMap((partner) => partner.suggestions)),
	);

	const total80CGap = partnerResults.reduce(
		(sum, partner) =>
			sum + Math.max(0, SECTION_80C_CAP - partner.deductions.section80CCurrent),
		0,
	);
	const total80DGap = partnerResults.reduce(
		(sum, partner) =>
			sum + Math.max(0, SECTION_80D_CAP - partner.deductions.section80DCurrent),
		0,
	);
	const totalNpsGap = partnerResults.reduce(
		(sum, partner) =>
			sum + Math.max(0, SECTION_80CCD1B_CAP - partner.deductions.section80CCD1BCurrent),
		0,
	);

	const annualInvestibleSurplus = toCurrencyNumber(totalSip + totalNps);
	const postTaxIncome = Math.max(0, toCurrencyNumber(totalIncome - totalOptimizedBestTax));
	const annualExpenseEstimate = Math.max(
		0,
		toCurrencyNumber(
			(postTaxIncome - annualInvestibleSurplus) * 1.05,
		),
	);
	const assumedAnnualReturnRate = getAssumedAnnualReturnRate(preferences.riskProfile);
	const inflationRate = getInflationRate(preferences.riskProfile);
	const realReturnRate = toRealReturnRate(assumedAnnualReturnRate, inflationRate);
	const targetCorpus =
		annualExpenseEstimate > 0
			? toCurrencyNumber(annualExpenseEstimate / FIRE_SAFE_WITHDRAWAL_RATE)
			: 0;
	const gapToFire = Math.max(0, targetCorpus - totalNetWorth);
	const estimatedYearsToFire = estimateYearsToTarget({
		currentCorpus: totalNetWorth,
		targetCorpus,
		annualContribution: annualInvestibleSurplus,
		annualReturnRate: realReturnRate,
		annualContributionStepUpRate: FIRE_ANNUAL_CONTRIBUTION_STEP_UP_RATE,
	});

	const rankedTaxSavingInvestments = buildRankedTaxSavingInvestments({
		preferences,
		total80CGap,
		totalNpsGap,
		total80DGap,
	});

	const npsPriorityPartner = [...partnerResults].sort(
		(a, b) => b.npsTaxBenefitPotential - a.npsTaxBenefitPotential,
	)[0];

	const coupleOptimizationInsights: string[] = [];
	if (npsPriorityPartner && npsPriorityPartner.npsTaxBenefitPotential > 0) {
		coupleOptimizationInsights.push(
			`NPS matching priority: ${npsPriorityPartner.partnerName} gives the highest NPS-linked tax benefit (${formatInr(
				npsPriorityPartner.npsTaxBenefitPotential,
			)} potential).`,
		);
	}

	if (total80DGap > 0) {
		coupleOptimizationInsights.push(
			`Insurance optimization: increase family/joint health cover premium by up to ${formatInr(
				total80DGap,
			)} to maximize 80D claims across both partners.`,
		);

		const averagePremium = totalInsurancePremium / request.partners.length;
		if (averagePremium < SECTION_80D_CAP * 0.5) {
			coupleOptimizationInsights.push(
				`Joint vs individual insurance: start with a family-floater top-up for broad coverage, then add individual riders only where risk is higher.`,
			);
		} else {
			coupleOptimizationInsights.push(
				`Joint vs individual insurance: retain individual base covers and add a shared floater as secondary protection for hospitalization spikes.`,
			);
		}
	}

	if (totalNetWorth > 0) {
		coupleOptimizationInsights.push(
			`Combined net worth is ${formatInr(totalNetWorth)} (assets ${formatInr(
				totalAssets,
			)}, liabilities ${formatInr(totalLiabilities)}).`,
		);
	} else {
		coupleOptimizationInsights.push(
			`Combined liabilities currently offset assets. Build emergency corpus first before aggressive tax-saving allocation.`,
		);
	}

	const healthScore = buildFinancialHealthScore({
		totalIncome,
		totalSip,
		totalNps,
		totalInsurancePremium,
		totalAssets,
		totalLiabilities,
		totalNetWorth,
		annualExpenseEstimate,
		leakageDetected,
		totalCurrentBestTax,
	});

	const lifeEventSimulator = buildLifeEventSimulator({
		totalIncome,
		annualExpenseEstimate,
		fireGap: gapToFire,
		lifeEvents: request.lifeEvents,
		inflationRate,
	});

	const mutualFundXRay = buildMutualFundXRay({
		totalIncome,
		totalSip,
		preferences,
	});

	return {
		preferences,
		household: {
			totalIncome,
			totalRent,
			totalSip,
			totalNps,
			totalInsurancePremium,
			totalAssets,
			totalLiabilities,
			totalNetWorth,
			totalCurrentBestTax,
			totalOptimizedBestTax,
			leakageDetected,
			oldRegimeCombinedTaxCurrent,
			oldRegimeCombinedTaxOptimized,
			newRegimeCombinedTax,
			recommendedCurrentRegime,
			recommendedOptimizedRegime,
		},
		partnerResults,
		coupleOptimizationInsights,
		optimizationSuggestions,
		advancedModules: {
			fireProjection: {
				annualExpenseEstimate,
				currentNetWorth: totalNetWorth,
				targetCorpus,
				gapToFire,
				estimatedYearsToFire,
				assumedAnnualReturnRate,
				annualInvestibleSurplus,
			},
			healthScore,
			lifeEventSimulator,
			mutualFundXRay,
		},
		rankedTaxSavingInvestments,
		assumptions: [
			"FY tax slabs used: Old regime and New regime (with standard deduction).",
			"Old regime standard deduction fixed at Rs 50,000.",
			"HRA approximation for optimization: basic salary = 40% of CTC, HRA received = 50% of basic salary.",
			"80C cap considered at Rs 1,50,000 and 80D cap at Rs 25,000 per partner.",
			"Additional NPS deduction under 80CCD(1B) considered up to Rs 50,000 per partner.",
			"Health insurance premium defaults to Rs 0 unless provided.",
			"Net worth is computed as total current assets minus total liabilities from user inputs.",
			"FIRE target corpus uses a 4% withdrawal rule with post-tax expense estimation.",
			"Years-to-FIRE projection uses inflation-adjusted real returns with 5% annual contribution step-up.",
			"Life event simulator uses user-provided events when available, otherwise default household events.",
		],
	};
}
