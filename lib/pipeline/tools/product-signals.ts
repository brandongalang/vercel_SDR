function isoDaysAgo(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

export function getMockProductSignals(input: {
  leadName: string;
  company: string;
  play: {
    type: string;
    label: string;
    context?: string;
    leadSource: string;
  };
}) {
  if (input.play.type === "plg_signup" || input.play.leadSource === "plg_product") {
    return {
      signalSource: "product_usage",
      summary: `${input.company} has recent first-party product activity tied to a likely evaluation workflow.`,
      items: [
        {
          label: "Preview deployment activity",
          detail: "Workspace shows repeat preview deployment activity over the last week.",
          observedAt: isoDaysAgo(3),
          pseudoSourceUrl: `internal://product/${encodeURIComponent(input.company.toLowerCase())}/preview-activity`,
        },
        {
          label: "Team footprint",
          detail: "More than one teammate appears active in the workspace, indicating collaborative evaluation.",
          observedAt: isoDaysAgo(2),
          pseudoSourceUrl: `internal://product/${encodeURIComponent(input.company.toLowerCase())}/team-footprint`,
        },
      ],
    };
  }

  if (input.play.type === "event") {
    return {
      signalSource: "event_activity",
      summary: `${input.leadName} is tied to a recent event signal that justifies timely follow-up.`,
      items: [
        {
          label: input.play.label,
          detail: input.play.context ?? "Recent event registration or attendance signal captured by marketing ops.",
          observedAt: isoDaysAgo(10),
          pseudoSourceUrl: `internal://events/${encodeURIComponent(input.company.toLowerCase())}/${encodeURIComponent(input.play.label.toLowerCase())}`,
        },
      ],
    };
  }

  return {
    signalSource: "internal_context",
    summary: `No rich first-party product activity is available for ${input.company}; use public research plus lightweight internal context.`,
    items: [
      {
        label: "Lead provenance",
        detail: `Lead source is ${input.play.leadSource.replace(/_/g, " ")}.`,
        observedAt: isoDaysAgo(1),
        pseudoSourceUrl: `internal://lead-source/${encodeURIComponent(input.play.leadSource)}`,
      },
    ],
  };
}

export type MockProductSignalsResult = ReturnType<typeof getMockProductSignals>;
