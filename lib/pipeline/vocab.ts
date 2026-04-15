export const CONFIDENCE_TIER_VALUES = ["high", "medium", "low"] as const;
export const GOVERNANCE_RULE_VALUES = ["review_required", "auto_eligible"] as const;
export const JOB_STATUS_VALUES = ["pending_review", "approved", "reviewed", "sent_stub"] as const;
export const PIPELINE_STATUS_VALUES = ["running", "completed", "failed"] as const;
export const PIPELINE_PHASE_VALUES = [
  "ingest",
  "research",
  "signals",
  "angle",
  "draft",
  "persist",
  "done",
] as const;
export const PIPELINE_PHASE_STATUS_VALUES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;

export const SIGNAL_CATEGORY_VALUES = [
  "event",
  "plg",
  "tech_stack",
  "social",
  "web_activity",
  "hiring_signal",
  "internal",
] as const;
export const SIGNAL_SOURCE_VALUES = ["internal", "external", "derived"] as const;
export const SIGNAL_STRENGTH_VALUES = ["strong", "moderate", "weak"] as const;

export const ANGLE_TYPE_VALUES = [
  "tech_migration",
  "trial_activation",
  "event_signal",
  "social_post",
  "web_intent",
  "hiring_signal",
  "generic",
] as const;

export const PLAY_TYPE_VALUES = [
  "plg_signup",
  "event",
  "hiring_signal",
  "tech_migration",
  "web_intent",
  "social_post",
  "outbound_prospecting",
] as const;

export const LEAD_SOURCE_VALUES = [
  "plg_product",
  "marketing_event_form",
  "marketing_event_scan",
  "crm_outbound",
  "social_listening",
  "web_deanonymization",
  "inbound_request",
] as const;

export const SIGNAL_SCOPE_VALUES = ["person", "company"] as const;
export const PERSON_ANGLE_STRENGTH_VALUES = ["strong", "moderate", "none"] as const;
export const INSIGHT_SOURCE_TYPE_VALUES = [
  "linkedin",
  "twitter",
  "conference",
  "blog",
  "podcast",
  "job_posting",
  "product_data",
  "news",
] as const;
