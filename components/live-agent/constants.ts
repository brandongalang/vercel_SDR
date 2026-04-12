import type { LeadInput, LeadSource, PlayType } from "@/lib/types";

export const PLAY_OPTIONS: Array<{ value: PlayType; label: string }> = [
  { value: "event", label: "Event" },
  { value: "plg_signup", label: "PLG signup" },
  { value: "hiring_signal", label: "Hiring signal" },
  { value: "tech_migration", label: "Tech migration" },
  { value: "web_intent", label: "Web intent" },
  { value: "social_post", label: "Social post" },
  { value: "outbound_prospecting", label: "Outbound prospecting" },
];

export const LEAD_SOURCE_OPTIONS: Array<{ value: LeadSource; label: string }> = [
  { value: "marketing_event_scan", label: "Marketing event scan" },
  { value: "marketing_event_form", label: "Marketing event form" },
  { value: "plg_product", label: "PLG product" },
  { value: "crm_outbound", label: "CRM outbound" },
  { value: "social_listening", label: "Social listening" },
  { value: "web_deanonymization", label: "Web deanonymization" },
  { value: "inbound_request", label: "Inbound request" },
];

export const DEFAULT_INPUT: LeadInput = {
  leadName: "Marcus Webb",
  leadTitle: "Engineering Manager, Frontend Platform",
  company: "Figma",
  companyDomain: "figma.com",
  freeformContext:
    "Met Marcus during the Vercel Ship 2026 breakout. He mentioned their frontend platform team is trying to speed up design system releases, keep preview environments dependable for designers, and reduce the review friction between design and engineering. The team also has an internal push to improve perceived performance before a larger enterprise rollout this quarter.",
  play: {
    type: "event",
    label: "Vercel Ship 2026",
    context: "Attended the preview workflows breakout and follow-up workshop",
    leadSource: "marketing_event_scan",
  },
};
