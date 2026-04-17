function hashValue(value: string) {
  return Array.from(value).reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

export function lookupMockCrm(input: {
  company: string;
  leadName: string;
  leadTitle: string;
  playType?: string;
  leadSource?: string;
}) {
  const hash = hashValue(`${input.company}:${input.leadName}:${input.leadTitle}`);
  const lifecycleStage =
    input.leadSource === "plg_product"
      ? "trial"
      : input.playType === "event"
        ? "event_follow_up"
        : hash % 5 === 0
          ? "customer_expansion"
          : "prospect";

  const owner = lifecycleStage === "customer_expansion" ? "Commercial AE" : "Commercial SDR";
  const segment = hash % 2 === 0 ? "commercial" : "mid-market";
  const accountPriority = hash % 3 === 0 ? "high" : hash % 3 === 1 ? "medium" : "standard";

  const notes = [
    lifecycleStage === "trial"
      ? "Recent product activity suggests an active evaluation rather than passive signup."
      : "No open opportunity is attached to this lead yet.",
    input.leadSource === "marketing_event_form"
      ? "Lead arrived from a sparse event form; treat public data as supplemental rather than definitive."
      : "Source quality supports outbound enrichment if public evidence is specific.",
    `Current segment tagged as ${segment}; account priority is ${accountPriority}.`,
  ];

  return {
    lifecycleStage,
    owner,
    segment,
    accountPriority,
    notes,
    pseudoSourceUrl: `internal://crm/${encodeURIComponent(input.company.toLowerCase())}`,
  };
}

export type MockCrmLookupResult = ReturnType<typeof lookupMockCrm>;
