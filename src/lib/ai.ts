import OpenAI from "openai";
import { z } from "zod";
import type {
	AiMentorResponse,
	HouseholdOptimizationResult,
	PartnerTaxResult,
} from "@/src/types/tax";

const aiMentorResponseSchema = z.object({
	plainEnglishSummary: z.string().min(20),
	householdNarrative: z.string().min(20),
	keyMoves: z.array(z.string().min(5)).min(3).max(8),
	hrEmailDrafts: z.array(
		z.object({
			partnerName: z.string().min(1),
			subject: z.string().min(5),
			body: z.string().min(20),
		}),
	),
});

const amountFormatter = new Intl.NumberFormat("en-IN");

function formatAmount(value: number): string {
	return `Rs ${amountFormatter.format(Math.max(0, Math.round(value)))}`;
}

function extractJsonPayload(rawContent: string): string {
	const fencedMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fencedMatch?.[1]) {
		return fencedMatch[1].trim();
	}

	const firstBrace = rawContent.indexOf("{");
	const lastBrace = rawContent.lastIndexOf("}");
	if (firstBrace >= 0 && lastBrace > firstBrace) {
		return rawContent.slice(firstBrace, lastBrace + 1);
	}

	return rawContent;
}

function buildFallbackDraft(partner: PartnerTaxResult): {
	partnerName: string;
	subject: string;
	body: string;
} {
	const topSuggestions = partner.suggestions.slice(0, 3);
	const suggestionLines = topSuggestions.length
		? topSuggestions.map((line) => `- ${line}`).join("\n")
		: "- Please review current declarations for tax optimization.";

	const subject =
		`Request to update tax declarations - ${partner.partnerName} - FY 2026-27`;

	const body = [
		"Hello HR Team,",
		"",
		"I would like to update my tax declarations for this financial year. Based on my planning review, please consider the following updates:",
		suggestionLines,
		"",
		"Please let me know if you need any supporting proofs or declaration forms from my side.",
		"",
		"Thanks and regards,",
		partner.partnerName,
	].join("\n");

	return {
		partnerName: partner.partnerName,
		subject,
		body,
	};
}

function buildFallbackResponse(
	optimization: HouseholdOptimizationResult,
): AiMentorResponse {
	const leakage = formatAmount(optimization.household.leakageDetected);
	const currentTax = formatAmount(optimization.household.totalCurrentBestTax);
	const optimizedTax = formatAmount(optimization.household.totalOptimizedBestTax);
	const savings = formatAmount(
		optimization.household.totalCurrentBestTax -
			optimization.household.totalOptimizedBestTax,
	);

	const plainEnglishSummary =
		`Your household currently has a tax leakage of ${leakage}. If you apply the recommended declarations, estimated annual tax can move from ${currentTax} to ${optimizedTax}, saving about ${savings}.`;

	const householdNarrative =
		`The plan compares old and new regimes for both partners, then applies HRA, 80C, and 80D optimization. Your best optimized regime is ${optimization.household.recommendedOptimizedRegime.toUpperCase()}, and the remaining cash flow after tax and SIP improves once declaration gaps are fixed.`;

	const keyMoves = optimization.optimizationSuggestions.slice(0, 6);
	const hrEmailDrafts = optimization.partnerResults.map(buildFallbackDraft);

	return {
		plainEnglishSummary,
		householdNarrative,
		keyMoves,
		hrEmailDrafts,
		generatedBy: "fallback",
	};
}

function buildPrompt(optimization: HouseholdOptimizationResult): string {
	return [
		"You are an expert Indian personal finance mentor writing for a couple.",
		"You receive deterministic tax outputs. Convert them into clear, useful, non-technical action guidance.",
		"Return STRICT JSON with this exact shape:",
		"{",
		'  "plainEnglishSummary": "string",',
		'  "householdNarrative": "string",',
		'  "keyMoves": ["string", "string", "..."],',
		'  "hrEmailDrafts": [',
		'    { "partnerName": "Partner A", "subject": "string", "body": "string" },',
		'    { "partnerName": "Partner B", "subject": "string", "body": "string" }',
		"  ]",
		"}",
		"Rules:",
		"- Be specific with numbers from input where relevant.",
		"- Keep language simple and human-readable.",
		"- Write HR email bodies as professional plain text, no markdown.",
		"- Do not include any keys outside the required JSON shape.",
		"Tax optimization input:",
		JSON.stringify(optimization),
	].join("\n");
}

function normalizeDrafts(
	optimization: HouseholdOptimizationResult,
	drafts: Array<{ partnerName: string; subject: string; body: string }>,
): Array<{ partnerName: string; subject: string; body: string }> {
	const fallbackByPartner = new Map(
		optimization.partnerResults.map((partner) => [
			partner.partnerName,
			buildFallbackDraft(partner),
		]),
	);

	const aiByPartner = new Map(
		drafts.map((draft) => [draft.partnerName.trim(), draft]),
	);

	return optimization.partnerResults.map((partner) => {
		const aiDraft = aiByPartner.get(partner.partnerName);
		if (aiDraft && aiDraft.subject && aiDraft.body) {
			return aiDraft;
		}
		return fallbackByPartner.get(partner.partnerName) as {
			partnerName: string;
			subject: string;
			body: string;
		};
	});
}

export async function generateAiMentorResponse(
	optimization: HouseholdOptimizationResult,
): Promise<AiMentorResponse> {
	const apiKey = process.env.OPENAI_API_KEY;

	if (!apiKey) {
		return buildFallbackResponse(optimization);
	}

	try {
		const client = new OpenAI({ apiKey });
		const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

		const completion = await client.chat.completions.create({
			model,
			temperature: 0.2,
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content:
						"You are a precise financial copilot. Always return valid JSON only.",
				},
				{
					role: "user",
					content: buildPrompt(optimization),
				},
			],
		});

		const content = completion.choices[0]?.message?.content;
		if (!content) {
			throw new Error("Empty response from OpenAI");
		}

		const parsedPayload = JSON.parse(extractJsonPayload(content));
		const parsed = aiMentorResponseSchema.safeParse(parsedPayload);
		if (!parsed.success) {
			throw new Error("OpenAI response did not match required schema");
		}

		return {
			plainEnglishSummary: parsed.data.plainEnglishSummary,
			householdNarrative: parsed.data.householdNarrative,
			keyMoves: parsed.data.keyMoves,
			hrEmailDrafts: normalizeDrafts(optimization, parsed.data.hrEmailDrafts),
			generatedBy: "openai",
		};
	} catch {
		return buildFallbackResponse(optimization);
	}
}
