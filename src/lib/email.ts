import { Resend } from "resend";
import type {
	EmailExecutionItem,
	EmailExecutionSummary,
	HrEmailDraft,
} from "@/src/types/tax";

type SendDraftEmailsInput = {
	drafts: HrEmailDraft[];
	recipientOverrides?: Record<string, string>;
};

function getRecipientForPartner(
	partnerName: string,
	recipientOverrides?: Record<string, string>,
): string | null {
	const normalizedName = partnerName.trim().toLowerCase();
	if (recipientOverrides?.[partnerName]) {
		return recipientOverrides[partnerName];
	}

	if (normalizedName === "partner a" && process.env.PARTNER_A_EMAIL) {
		return process.env.PARTNER_A_EMAIL;
	}

	if (normalizedName === "partner b" && process.env.PARTNER_B_EMAIL) {
		return process.env.PARTNER_B_EMAIL;
	}

	if (process.env.DEMO_EMAIL_TO) {
		return process.env.DEMO_EMAIL_TO;
	}

	return null;
}

export async function sendHrDraftEmails({
	drafts,
	recipientOverrides,
}: SendDraftEmailsInput): Promise<EmailExecutionSummary> {
	const apiKey = process.env.RESEND_API_KEY;
	const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

	if (!apiKey) {
		const results: EmailExecutionItem[] = drafts.map((draft) => ({
			partnerName: draft.partnerName,
			to: getRecipientForPartner(draft.partnerName, recipientOverrides),
			status: "skipped",
			provider: "fallback",
			error:
				"RESEND_API_KEY missing. Returning draft-only mode for demo fallback.",
		}));

		return {
			mode: "draft-only",
			provider: "fallback",
			summary:
				"Email provider not configured. HR drafts generated successfully and ready for manual send.",
			results,
		};
	}

	const resend = new Resend(apiKey);
	const results: EmailExecutionItem[] = [];

	for (const draft of drafts) {
		const to = getRecipientForPartner(draft.partnerName, recipientOverrides);

		if (!to) {
			results.push({
				partnerName: draft.partnerName,
				to: null,
				status: "skipped",
				provider: "fallback",
				error:
					"No recipient found. Set PARTNER_A_EMAIL, PARTNER_B_EMAIL, DEMO_EMAIL_TO, or recipientOverrides.",
			});
			continue;
		}

		try {
			const response = await resend.emails.send({
				from: fromEmail,
				to: [to],
				subject: draft.subject,
				text: draft.body,
			});

			if (response.error) {
				results.push({
					partnerName: draft.partnerName,
					to,
					status: "failed",
					provider: "resend",
					error: response.error.message,
				});
			} else {
				results.push({
					partnerName: draft.partnerName,
					to,
					status: "sent",
					provider: "resend",
					id: response.data?.id,
				});
			}
		} catch (error) {
			results.push({
				partnerName: draft.partnerName,
				to,
				status: "failed",
				provider: "resend",
				error:
					error instanceof Error ? error.message : "Unknown Resend failure",
			});
		}
	}

	const sentCount = results.filter((entry) => entry.status === "sent").length;
	const failedCount = results.filter((entry) => entry.status === "failed").length;
	const skippedCount = results.filter((entry) => entry.status === "skipped").length;

	return {
		mode: sentCount > 0 ? "sent" : "draft-only",
		provider: sentCount > 0 ? "resend" : "fallback",
		summary: `Email execution completed. Sent: ${sentCount}, Failed: ${failedCount}, Skipped: ${skippedCount}.`,
		results,
	};
}
