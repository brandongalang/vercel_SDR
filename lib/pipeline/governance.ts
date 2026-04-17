import type { ConfidenceTier, GovernanceRule, LeadSource, PipelineStatus } from "@/lib/types";

export function determineGovernance(input: {
  confidenceTier: ConfidenceTier;
  leadSource: LeadSource;
  companySize?: string;
}) {
  const cautiousSources: LeadSource[] = [
    "marketing_event_form",
    "marketing_event_scan",
    "social_listening",
    "web_deanonymization",
    "inbound_request",
  ];

  const governance: GovernanceRule =
    input.confidenceTier === "low" ||
    input.companySize === "enterprise" || 
    cautiousSources.includes(input.leadSource)
      ? "review_required"
      : "auto_eligible";

  return {
    governance,
    pipelineStage: "complete",
    pipelineStatus: "completed" as PipelineStatus,
    status: "pending_review" as const,
  };
}
