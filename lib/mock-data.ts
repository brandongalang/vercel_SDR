import { LeadSource, OutboundJob, Play, PlayType } from "./types";

const hoursAgo = (hours: number) => new Date(Date.now() - 1000 * 60 * 60 * hours).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - 1000 * 60 * 60 * 24 * days).toISOString();

type LegacyResearchRun = {
  label: string;
  leadSource: string;
  scope: string;
  contactsScanned: number;
  accountsTouched: number;
  shortlisted: number;
  selectedRank: number;
  whyChosen: string;
  whyNow: string;
  uncertainty: string;
  sourceSummary: Array<{ label: string; count?: number; note?: string }>;
  candidateComparisons: Array<unknown>;
  angleDecisions: Array<{
    angleType: string;
    summary: string;
    selected: boolean;
    reason: string;
  }>;
};

type LegacyMockJob = Omit<OutboundJob, "play" | "whyNow" | "researchRun"> & {
  play: string;
  researchRun: LegacyResearchRun;
};

function researchRun(run: LegacyResearchRun): LegacyResearchRun {
  return run;
}

const LEGACY_MOCK_JOBS: LegacyMockJob[] = [
  {
    id: "job-001",
    lead: { name: "Sarah Kim", title: "VP Engineering" },
    company: "Acme Corp",
    play: "PLG Signup",
    researchRun: researchRun({
      label: "Lead enrichment pass",
      leadSource: "Product-qualified signup",
      scope: "Enriched an existing product-qualified lead with one internal activation signal and one public hiring signal before drafting the first touch.",
      contactsScanned: 1,
      accountsTouched: 1,
      shortlisted: 1,
      selectedRank: 1,
      whyChosen:
        "The message leads with preview-workflow scale-up because Acme's product activity and hiring language point to the same operational problem.",
      whyNow:
        "Acme started a Vercel trial this week, invited multiple teammates, and opened a platform role focused on preview environments and developer workflow.",
      uncertainty:
        "We know Sarah owns the engineering org. We do not know whether she will delegate this evaluation to platform leadership.",
      sourceSummary: [
        { label: "Workspace activation", count: 9, note: "Trial creation, preview deploys, and teammate invites." },
        { label: "Public hiring signals", count: 2, note: "Role language around frontend platform and release workflow." },
        { label: "Lead source context", count: 1, note: "Existing product-qualified lead." },
      ],
      candidateComparisons: [],
      angleDecisions: [
        {
          angleType: "hiring_signal",
          summary: "Lead with team growth around platform workflow.",
          selected: true,
          reason: "Makes the first email feel timely without sounding invasive.",
        },
        {
          angleType: "trial_activation",
          summary: "Lead with the new trial alone.",
          selected: false,
          reason: "Good support signal, but too generic as the opening hook.",
        },
      ],
    }),
    angleType: "hiring_signal",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "review_required",
    confidence: {
      tier: "high",
      summary: "Strong lead-enrichment pair: real product activity plus a public signal that supports the same story.",
      reasons: [
        "Workspace created 4 days ago with 9 preview deployments and 3 teammates invited.",
        "Acme opened a senior frontend platform role mentioning preview workflow and edge delivery.",
        "The message can sound human without needing to mention sensitive browsing behavior.",
      ],
    },
    angle:
      "Acme looks like it is standing up a more serious preview workflow, so the best first touch is a practical note about scaling that rollout cleanly.",
    signals: [
      {
        id: "sig-01",
        category: "internal",
        label: "New workspace with active preview usage",
        value: "Workspace created 4 days ago with 9 preview deployments, 3 teammates invited, and two active projects.",
        source: "internal",
        rank: 1,
        strength: "strong",
        usedInAngle: true,
      },
      {
        id: "sig-02",
        category: "social",
        label: "Hiring for frontend platform workflow",
        value: "Acme's public careers page opened a Senior Frontend Platform Engineer role focused on preview workflow, edge delivery, and release tooling.",
        source: "external",
        rank: 2,
        strength: "strong",
        usedInAngle: true,
        evidenceUrl: "https://acme.example/careers/frontend-platform",
      },
      {
        id: "sig-03",
        category: "event",
        label: "Registered for Vercel workshop",
        value: "Two Acme engineers registered for a recent Vercel preview environments workshop.",
        source: "external",
        rank: 3,
        strength: "moderate",
        usedInAngle: false,
      },
    ],
    discardedSignals: [
      {
        label: "Workshop registration",
        reason: "Helpful context, but weaker than the activation plus hiring combination.",
      },
    ],
    draft: {
      subject: "Scaling preview workflow as Acme ramps up",
      body: `Hi Sarah,

Saw Acme is hiring around frontend platform workflow just as your Vercel workspace activity picked up this week.

That usually means preview environments and release coordination are becoming more important fast. We have been helping engineering teams tighten that part of the rollout without adding more internal process. Open to a quick compare-notes conversation?

Best,`,
      highlightedSpan:
        "That usually means preview environments and release coordination are becoming more important fast.",
    },
    timestamps: {
      created: hoursAgo(5),
      updated: hoursAgo(1),
    },
  },
  {
    id: "job-002",
    lead: { name: "Devin Ross", title: "Director of Platform" },
    company: "LedgerLoop",
    play: "Web Activity",
    researchRun: researchRun({
      label: "Lead enrichment pass",
      leadSource: "Outbound account list",
      scope: "Enriched an existing outbound lead with one internal docs-intent signal and one public leadership signal to choose a credible first-touch perspective.",
      contactsScanned: 1,
      accountsTouched: 1,
      shortlisted: 1,
      selectedRank: 1,
      whyChosen:
        "The message leads with consolidation because the public platform narrative and the recent docs interest point to the same evaluation story.",
      whyNow:
        "LedgerLoop returned to routing, middleware, and pricing docs within 48 hours of Devin posting about reducing tool sprawl across the platform team.",
      uncertainty:
        "The docs activity is compelling account-level evidence, but we cannot prove Devin personally drove that evaluation.",
      sourceSummary: [
        { label: "Docs and pricing activity", count: 5, note: "Routing, middleware, ISR, and pricing." },
        { label: "Leadership narrative", count: 1, note: "Recent public post about platform consolidation." },
        { label: "Lead source context", count: 1, note: "Existing outbound target from the account list." },
      ],
      candidateComparisons: [],
      angleDecisions: [
        {
          angleType: "social_post",
          summary: "Lead with Devin's consolidation narrative.",
          selected: true,
          reason: "Lets the email sound human while still grounded in recent product interest.",
        },
        {
          angleType: "web_intent",
          summary: "Lead with the docs activity directly.",
          selected: false,
          reason: "Useful support signal, but more awkward if stated too literally in the opening line.",
        },
      ],
    }),
    angleType: "social_post",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "review_required",
    confidence: {
      tier: "high",
      summary: "The angle is believable because the public narrative and internal activity match cleanly.",
      reasons: [
        "Recent docs cluster around routing, middleware, and pricing.",
        "Devin publicly talked about reducing platform sprawl last week.",
        "The message can anchor on a perspective instead of dumping every signal.",
      ],
    },
    angle:
      "Devin already framed the problem publicly, and LedgerLoop's internal activity suggests the team is now actively evaluating options against that same platform-consolidation story.",
    signals: [
      {
        id: "sig-04",
        category: "web_activity",
        label: "Docs cluster around routing and middleware",
        value: "LedgerLoop returned to routing, middleware, ISR, and pricing pages five times over two days.",
        source: "internal",
        rank: 1,
        strength: "strong",
        usedInAngle: true,
      },
      {
        id: "sig-05",
        category: "social",
        label: "Leadership post on reducing tool sprawl",
        value: "Devin posted about simplifying the platform stack and removing unnecessary internal tooling.",
        source: "external",
        rank: 2,
        strength: "strong",
        usedInAngle: true,
        evidenceUrl: "https://linkedin.com/in/devinross",
      },
      {
        id: "sig-06",
        category: "internal",
        label: "No active workspace yet",
        value: "There is no active Vercel workspace for LedgerLoop yet.",
        source: "internal",
        rank: 3,
        strength: "moderate",
        usedInAngle: false,
      },
    ],
    discardedSignals: [
      {
        label: "No active workspace",
        reason: "Useful internally for confidence, but not a good opening line for the first email.",
      },
    ],
    draft: {
      subject: "Platform consolidation timing at LedgerLoop",
      body: `Hi Devin,

Your note about reducing platform sprawl stood out, especially since LedgerLoop has been back in the weeds on routing and middleware questions this week.

We work with platform teams when that consolidation effort starts turning into release-workflow decisions. If that is on your plate this quarter, open to a quick comparison call?

Best,`,
      highlightedSpan:
        "We work with platform teams when that consolidation effort starts turning into release-workflow decisions.",
    },
    timestamps: {
      created: hoursAgo(10),
      updated: hoursAgo(2),
    },
  },
  {
    id: "job-003",
    lead: { name: "Alana Brooks", title: "CTO" },
    company: "Northstar Health",
    play: "Event Signal",
    researchRun: researchRun({
      label: "Lead enrichment pass",
      leadSource: "Outbound data provider",
      scope: "Enriched an existing outbound lead with one event signal and one internal enterprise-interest signal to see whether a safe first-touch angle existed.",
      contactsScanned: 1,
      accountsTouched: 1,
      shortlisted: 1,
      selectedRank: 1,
      whyChosen:
        "The message uses a secure-release angle because it is the only perspective grounded in both a public event touchpoint and internal enterprise-interest behavior.",
      whyNow:
        "Northstar attended a healthcare infrastructure webinar and then returned to enterprise security and audit-log pages in the same week.",
      uncertainty:
        "The account-level timing feels real, but the message can still drift into a surveillance tone if we overstate the internal behavior.",
      sourceSummary: [
        { label: "Event context", count: 1, note: "Healthcare infrastructure webinar attendee list." },
        { label: "Enterprise interest", count: 4, note: "Security, audit logs, and access control pages." },
        { label: "Lead source context", count: 1, note: "Existing outbound lead from data enrichment." },
      ],
      candidateComparisons: [],
      angleDecisions: [
        {
          angleType: "event_signal",
          summary: "Lead with the secure release workflow theme from the webinar.",
          selected: true,
          reason: "Safer than opening with the internal page activity alone.",
        },
        {
          angleType: "web_intent",
          summary: "Lead with enterprise security page visits.",
          selected: false,
          reason: "More direct, but too likely to sound creepy in the opening line.",
        },
      ],
    }),
    angleType: "event_signal",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "review_required",
    confidence: {
      tier: "medium",
      summary: "The system found a workable angle, but the rep still needs to pressure-test the tone.",
      reasons: [
        "Healthcare infrastructure webinar is a valid public signal.",
        "Enterprise security interest is real but should stay as supporting evidence, not quoted directly.",
        "This is the kind of draft that may need a softening edit before approval.",
      ],
    },
    angle:
      "Northstar has enough signal to justify a secure-release conversation, but the message should stay anchored in the public event context rather than leading with internal behavior.",
    signals: [
      {
        id: "sig-07",
        category: "event",
        label: "Attended healthcare infrastructure webinar",
        value: "Northstar appeared on the attendee list for a recent webinar about secure release workflows in regulated environments.",
        source: "external",
        rank: 1,
        strength: "strong",
        usedInAngle: true,
      },
      {
        id: "sig-08",
        category: "web_activity",
        label: "Enterprise security docs returned to this week",
        value: "Northstar returned to enterprise security, audit log, and access-control pages four times this week.",
        source: "internal",
        rank: 2,
        strength: "moderate",
        usedInAngle: true,
      },
    ],
    discardedSignals: [
      {
        label: "Directly citing the page visits",
        reason: "That would make the first email sound invasive rather than helpful.",
      },
    ],
    draft: {
      subject: "Secure release workflow for regulated teams",
      body: `Hi Alana,

Saw Northstar joined the healthcare infrastructure webinar on secure release workflow. That topic tends to come up when teams want tighter control without slowing engineers down.

We have been helping regulated engineering orgs simplify preview access, auditability, and release guardrails. Would a short conversation be useful?

Best,`,
      highlightedSpan:
        "That topic tends to come up when teams want tighter control without slowing engineers down.",
    },
    timestamps: {
      created: hoursAgo(16),
      updated: hoursAgo(4),
    },
  },
  {
    id: "job-004",
    lead: { name: "Jon Park", title: "Head of Platform" },
    company: "BrightOps",
    play: "Tech Stack",
    researchRun: researchRun({
      label: "Lead enrichment pass",
      leadSource: "Marketing handoff",
      scope: "Enriched an existing marketing lead with one public engineering narrative and one internal product signal before drafting the first touch.",
      contactsScanned: 1,
      accountsTouched: 1,
      shortlisted: 1,
      selectedRank: 1,
      whyChosen:
        "The message leads with release-workflow simplification because BrightOps is publicly talking about frontend delivery and has matching product activity internally.",
      whyNow:
        "BrightOps published an engineering note about simplifying frontend release workflow the same week its Vercel workspace crossed from trial setup into recurring preview usage.",
      uncertainty:
        "The thesis is strong. The likely failure mode here is tone: the copy needs to sound practical, not salesy.",
      sourceSummary: [
        { label: "Public engineering content", count: 1, note: "Release workflow and frontend delivery post." },
        { label: "Workspace activity", count: 6, note: "Recurring preview deploys and teammate growth." },
        { label: "Lead source context", count: 1, note: "Existing marketing handoff from a webinar follow-up." },
      ],
      candidateComparisons: [],
      angleDecisions: [
        {
          angleType: "tech_migration",
          summary: "Lead with simplifying the release workflow transition.",
          selected: true,
          reason: "Feels operational and specific without leaning on private implementation details.",
        },
        {
          angleType: "trial_activation",
          summary: "Lead with the workspace activity by itself.",
          selected: false,
          reason: "Useful proof, but weaker than the workflow story.",
        },
      ],
    }),
    angleType: "tech_migration",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "review_required",
    confidence: {
      tier: "high",
      summary: "Strong lead-enrichment result. The review question is mostly about wording, not thesis quality.",
      reasons: [
        "BrightOps publicly described release workflow simplification work.",
        "The account has recurring preview usage and teammate growth in product.",
        "The message can stay specific without sounding like surveillance.",
      ],
    },
    angle:
      "BrightOps already looks committed to simplifying frontend release workflow, so the best first touch is a practical note about tightening that transition rather than a generic activation email.",
    signals: [
      {
        id: "sig-09",
        category: "tech_stack",
        label: "Engineering note on release workflow simplification",
        value: "BrightOps published an engineering note about reducing friction in frontend release workflow and standardizing preview handoff.",
        source: "external",
        rank: 1,
        strength: "strong",
        usedInAngle: true,
        evidenceUrl: "https://brightops.example/blog/release-workflow",
      },
      {
        id: "sig-10",
        category: "internal",
        label: "Recurring preview usage in new workspace",
        value: "BrightOps has six preview deployments and teammate growth in a newly active Vercel workspace this week.",
        source: "internal",
        rank: 2,
        strength: "strong",
        usedInAngle: true,
      },
    ],
    discardedSignals: [
      {
        label: "Generic webinar attendance",
        reason: "Good context for routing the lead, but not strong enough to anchor the message.",
      },
    ],
    draft: {
      subject: "Simplifying release workflow at BrightOps",
      body: `Hi Jon,

Saw BrightOps has been talking publicly about simplifying frontend release workflow just as your Vercel usage started to look more serious this week.

That is usually the moment preview handoff and release coordination start becoming real platform work. We have been helping teams tighten that up without adding another process layer. Worth a quick compare-notes call?

Best,`,
      highlightedSpan:
        "That is usually the moment preview handoff and release coordination start becoming real platform work.",
    },
    timestamps: {
      created: hoursAgo(8),
      updated: hoursAgo(3),
    },
  },
  {
    id: "job-005",
    lead: { name: "Nora Bell", title: "Engineering Manager" },
    company: "Caregrid",
    play: "PLG Signup",
    researchRun: researchRun({
      label: "Lead enrichment pass",
      leadSource: "Marketing handoff",
      scope: "Enriched an existing marketing lead, but the signals never became strong enough to justify a persuasive first-touch.",
      contactsScanned: 1,
      accountsTouched: 1,
      shortlisted: 1,
      selectedRank: 1,
      whyChosen:
        "The system defaulted to a lightweight activation angle because no stronger perspective emerged from the lead-enrichment pass.",
      whyNow:
        "Caregrid started a very small workspace and attended a webinar, but neither created a strong reason to reach out now.",
      uncertainty:
        "High uncertainty overall. This is the kind of lead the rep should feel comfortable archiving.",
      sourceSummary: [
        { label: "Workspace activity", count: 2, note: "One preview deploy and no teammate growth." },
        { label: "Event context", count: 1, note: "Attended a webinar but did not engage further." },
        { label: "Lead source context", count: 1, note: "Existing marketing handoff." },
      ],
      candidateComparisons: [],
      angleDecisions: [
        {
          angleType: "trial_activation",
          summary: "Lead with light product activity.",
          selected: true,
          reason: "Best available option, even though it is weak.",
        },
        {
          angleType: "event_signal",
          summary: "Lead with webinar attendance.",
          selected: false,
          reason: "Too soft on its own to support a worthwhile first email.",
        },
      ],
    }),
    angleType: "trial_activation",
    status: "reviewed",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidence: {
      tier: "low",
      summary: "Useful as a calibration example: the system looked, but the lead never earned a strong message.",
      reasons: [
        "Only one preview deployment and no teammate growth.",
        "No public company movement that creates a natural why-now.",
        "Archive is the right decision here.",
      ],
    },
    angle:
      "Caregrid had just enough activity to produce a draft, but not enough to justify sending one.",
    signals: [
      {
        id: "sig-11",
        category: "internal",
        label: "Very light workspace activity",
        value: "Workspace created 9 days ago with one preview deployment and no teammate invites.",
        source: "internal",
        rank: 1,
        strength: "moderate",
        usedInAngle: true,
      },
      {
        id: "sig-12",
        category: "event",
        label: "Single webinar attendance",
        value: "Caregrid attended a Vercel onboarding webinar last month but did not engage further.",
        source: "external",
        rank: 2,
        strength: "weak",
        usedInAngle: false,
      },
    ],
    discardedSignals: [
      {
        label: "Webinar attendance",
        reason: "Not enough by itself to justify a first email.",
      },
    ],
    draft: {
      subject: "Getting value from a new Vercel workspace",
      body: `Hi Nora,

Looks like your team recently started testing Vercel. Reaching out in case it would help to compare how other engineering teams get value quickly in the first couple of weeks.

Happy to share notes if useful.

Best,`,
    },
    timestamps: {
      created: hoursAgo(22),
      updated: hoursAgo(6),
    },
  },
  {
    id: "job-006",
    lead: { name: "Priya Nair", title: "Engineering Manager" },
    company: "CloudBase",
    play: "PLG Signup",
    researchRun: researchRun({
      label: "Lead enrichment pass",
      leadSource: "Product-qualified signup",
      scope: "Enriched an existing product-qualified lead with activation behavior and a nearby public event touchpoint to produce a straightforward first-touch.",
      contactsScanned: 1,
      accountsTouched: 1,
      shortlisted: 1,
      selectedRank: 1,
      whyChosen:
        "The message stays simple because the product activity is already enough to justify an activation-focused first email.",
      whyNow:
        "CloudBase created a workspace, invited teammates, and joined a Vercel setup workshop in the same week.",
      uncertainty:
        "The signal is real but still lightweight. This is about being timely and useful, not deeply researched.",
      sourceSummary: [
        { label: "Workspace activation", count: 5, note: "Project creation, preview deploys, and teammate invites." },
        { label: "Event context", count: 1, note: "Recent setup workshop attendance." },
      ],
      candidateComparisons: [],
      angleDecisions: [
        {
          angleType: "trial_activation",
          summary: "Lead with early activation help.",
          selected: true,
          reason: "Most natural and least forced for this lead.",
        },
      ],
    }),
    angleType: "trial_activation",
    status: "approved",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidence: {
      tier: "medium",
      summary: "Clean activation follow-up with no obvious stronger angle.",
      reasons: [
        "New workspace with teammate growth.",
        "Workshop attendance supports a practical setup conversation.",
      ],
    },
    angle:
      "Priya's team recently started using Vercel, so a simple activation-focused first touch is more useful than a heavier research angle.",
    signals: [
      {
        id: "sig-13",
        category: "internal",
        label: "Workspace started with teammate growth",
        value: "Workspace created 10 days ago with two preview environments and three teammates invited.",
        source: "internal",
        rank: 1,
        strength: "moderate",
        usedInAngle: true,
      },
      {
        id: "sig-14",
        category: "event",
        label: "Attended setup workshop",
        value: "CloudBase attended a Vercel setup workshop earlier this week.",
        source: "external",
        rank: 2,
        strength: "moderate",
        usedInAngle: false,
      },
    ],
    draft: {
      subject: "Getting value from your new Vercel setup",
      body: `Hi Priya,

Looks like your team is getting started with Vercel. Wanted to reach out early in case it would help to compare how other engineering teams get value in the first couple of weeks.

Happy to do a quick setup call or answer any questions. What are you evaluating first?

Best,`,
      highlightedSpan: "What are you evaluating first?",
    },
    feedback: { edited: false },
    timestamps: {
      created: daysAgo(2),
      updated: daysAgo(1.5),
    },
  },
  {
    id: "job-sent-01",
    lead: { name: "Chris Patel", title: "Director of Engineering" },
    company: "Northwind Labs",
    play: "Hiring Signal",
    researchRun: researchRun({
      label: "Historical send record",
      leadSource: "Outbound account list",
      scope: "Historical generated first-touch retained for analytics calibration.",
      contactsScanned: 1,
      accountsTouched: 1,
      shortlisted: 1,
      selectedRank: 1,
      whyChosen:
        "A hiring signal plus new product usage created a practical first-touch about scaling preview workflow.",
      whyNow:
        "Northwind opened a platform role the same week its Vercel usage expanded.",
      uncertainty: "Low uncertainty.",
      sourceSummary: [
        { label: "Hiring signals", count: 1 },
        { label: "Workspace activation", count: 4 },
      ],
      candidateComparisons: [],
      angleDecisions: [
        {
          angleType: "hiring_signal",
          summary: "Hiring plus activation timing",
          selected: true,
          reason: "Strongest public + internal pairing on the lead.",
        },
      ],
    }),
    angleType: "hiring_signal",
    status: "sent_stub",
    pipelineStage: "complete",
    governance: "review_required",
    confidence: { tier: "high", summary: "Historical strong hiring-signal send.", reasons: [] },
    angle: "Northwind's hiring signal and product activity lined up cleanly.",
    signals: [],
    draft: {
      subject: "(sent) Preview workflow scale-up",
      body: "Hi Chris,\n\nSaw the platform hiring push as your Vercel usage picked up…\n\nBest,",
    },
    feedback: { edited: false },
    outcome: { replied: true, positive: true },
    timestamps: { created: daysAgo(14), updated: daysAgo(12) },
  },
  {
    id: "job-sent-02",
    lead: { name: "Jordan Lee", title: "Platform Lead" },
    company: "PixelForge",
    play: "Web Activity",
    researchRun: researchRun({
      label: "Historical send record",
      leadSource: "Product-qualified signup",
      scope: "Historical generated first-touch retained for edit-vs-clean-accept analytics.",
      contactsScanned: 1,
      accountsTouched: 1,
      shortlisted: 1,
      selectedRank: 1,
      whyChosen:
        "A leadership narrative plus docs activity created a plausible first-touch, but the draft needed tone edits before send.",
      whyNow:
        "Platform simplification post aligned with recent routing and middleware interest.",
      uncertainty: "Moderate uncertainty on tone.",
      sourceSummary: [
        { label: "Leadership narrative", count: 1 },
        { label: "Docs activity", count: 3 },
      ],
      candidateComparisons: [],
      angleDecisions: [
        {
          angleType: "social_post",
          summary: "Narrative plus docs timing",
          selected: true,
          reason: "Believable, but a little too sharp without editing.",
        },
      ],
    }),
    angleType: "social_post",
    status: "sent_stub",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidence: { tier: "medium", summary: "Historical edited send.", reasons: [] },
    angle: "Jordan's message worked, but the SDR softened the tone before approval.",
    signals: [],
    draft: {
      subject: "(sent) Platform simplification timing",
      body: "Hi Jordan,\n\nYour post on simplifying the platform stack caught my eye…\n\nBest,",
    },
    feedback: { edited: true, editorNote: "Softened the opening and CTA." },
    outcome: { replied: true, positive: false },
    timestamps: { created: daysAgo(10), updated: daysAgo(9) },
  },
  {
    id: "job-sent-03",
    lead: { name: "Taylor Brooks", title: "Head of Growth" },
    company: "SignalNine",
    play: "Event Signal",
    researchRun: researchRun({
      label: "Historical send record",
      leadSource: "Marketing handoff",
      scope: "Historical generated first-touch retained for analytics calibration.",
      contactsScanned: 1,
      accountsTouched: 1,
      shortlisted: 1,
      selectedRank: 1,
      whyChosen:
        "Event attendance plus product activity gave the system just enough to send a lighter first-touch.",
      whyNow:
        "Workshop attendance lined up with new product activity.",
      uncertainty: "Moderate uncertainty on urgency.",
      sourceSummary: [
        { label: "Event context", count: 1 },
        { label: "Product activity", count: 2 },
      ],
      candidateComparisons: [],
      angleDecisions: [
        {
          angleType: "event_signal",
          summary: "Event follow-up with product context",
          selected: true,
          reason: "Safe enough to send, but not the strongest response driver.",
        },
      ],
    }),
    angleType: "event_signal",
    status: "sent_stub",
    pipelineStage: "complete",
    governance: "review_required",
    confidence: { tier: "medium", summary: "Historical event-signal send.", reasons: [] },
    angle: "Taylor's message used the event context as a lightweight reason to reach out.",
    signals: [],
    draft: {
      subject: "(sent) Following up after the workshop",
      body: "Hi Taylor,\n\nFollowing up after the workshop while your team is getting started…\n\nBest,",
    },
    feedback: { edited: false },
    outcome: { replied: false, positive: false },
    timestamps: { created: daysAgo(6), updated: daysAgo(5) },
  },
];

// ─── DSPy prompt version epochs (mock) ───────────────────────────────────────
// Three synthetic compile epochs used to populate the version-attributed analytics panel.
// v1 = baseline (high edit rate, low positive), v2 = first compile, v3 = current (best clean accept).

const DSPY_PROMPT_VERSIONS_V1: Record<string, string> = {
  researchOrchestrator: "2026-01-20.research-orchestrator.v1",
  researchThread: "2026-01-20.research-thread.v1",
  signalExtractor: "2026-01-20.signal-extractor.v1",
  anglePlanner: "2026-01-20.angle-planner.v1",
  draftGenerator: "2026-01-20.draft-generator.v1",
};

const DSPY_PROMPT_VERSIONS_V2: Record<string, string> = {
  researchOrchestrator: "2026-02-17.research-orchestrator.v1",
  researchThread: "2026-02-17.research-thread.v1",
  signalExtractor: "2026-02-17.signal-extractor.v1",
  anglePlanner: "2026-02-17.angle-planner.v2",
  draftGenerator: "2026-02-17.draft-generator.v2",
};

const DSPY_PROMPT_VERSIONS_V3: Record<string, string> = {
  researchOrchestrator: "2026-04-11.research-orchestrator.v1",
  researchThread: "2026-04-11.research-thread.v1",
  signalExtractor: "2026-04-11.signal-extractor.v1",
  anglePlanner: "2026-04-11.angle-planner.v1",
  draftGenerator: "2026-04-11.draft-generator.v3",
};

// Version assignment per job ID — older sent jobs use earlier versions to show improvement over time.
const JOB_PROMPT_VERSIONS: Record<string, Record<string, string>> = {
  "job-001": DSPY_PROMPT_VERSIONS_V3,
  "job-002": DSPY_PROMPT_VERSIONS_V3,
  "job-003": DSPY_PROMPT_VERSIONS_V3,
  "job-004": DSPY_PROMPT_VERSIONS_V3,
  "job-005": DSPY_PROMPT_VERSIONS_V3,
  "job-006": DSPY_PROMPT_VERSIONS_V3,
  "job-sent-01": DSPY_PROMPT_VERSIONS_V3,
  "job-sent-02": DSPY_PROMPT_VERSIONS_V2,
  "job-sent-03": DSPY_PROMPT_VERSIONS_V1,
  "job-hist-v1-01": DSPY_PROMPT_VERSIONS_V1,
  "job-hist-v1-02": DSPY_PROMPT_VERSIONS_V1,
  "job-hist-v1-03": DSPY_PROMPT_VERSIONS_V1,
  "job-hist-v2-01": DSPY_PROMPT_VERSIONS_V2,
  "job-hist-v2-02": DSPY_PROMPT_VERSIONS_V2,
};

// Historical sent jobs to populate v1 and v2 version buckets for analytics
const HISTORICAL_SENT_JOBS: LegacyMockJob[] = [
  // v1 bucket — high edit rate, no positive replies
  {
    id: "job-hist-v1-01",
    lead: { name: "Alex Monroe", title: "Engineering Manager" },
    company: "GridStack",
    play: "Hiring Signal",
    researchRun: researchRun({
      label: "Historical send record",
      leadSource: "Outbound account list",
      scope: "v1 baseline draft — rep edited before sending.",
      contactsScanned: 1, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Hiring signal plus product activity.", whyNow: "Hiring signal aligned with trial start.",
      uncertainty: "Moderate.",
      sourceSummary: [{ label: "Hiring signals", count: 1 }, { label: "Product activity", count: 2 }],
      candidateComparisons: [], angleDecisions: [],
    }),
    angleType: "hiring_signal",
    status: "sent_stub",
    pipelineStage: "complete",
    governance: "review_required",
    confidence: { tier: "medium", summary: "v1 baseline draft.", reasons: [] },
    angle: "Hiring angle with product context.", signals: [],
    draft: { subject: "Platform workflow timing", body: "Hi Alex,\n\nNoticed the hiring push…\n\nBest," },
    feedback: { edited: true, editorNote: "Rewrote opening — too generic." },
    outcome: { replied: false, positive: false },
    timestamps: { created: daysAgo(55), updated: daysAgo(54) },
  },
  {
    id: "job-hist-v1-02",
    lead: { name: "Sam Okafor", title: "Head of Platform" },
    company: "Vanta Systems",
    play: "Web Activity",
    researchRun: researchRun({
      label: "Historical send record",
      leadSource: "Web deanonymization",
      scope: "v1 baseline draft — rep edited before sending.",
      contactsScanned: 1, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Web intent signal.", whyNow: "Multiple docs visits in same week.",
      uncertainty: "Moderate.",
      sourceSummary: [{ label: "Web intent", count: 5 }],
      candidateComparisons: [], angleDecisions: [],
    }),
    angleType: "web_intent",
    status: "sent_stub",
    pipelineStage: "complete",
    governance: "review_required",
    confidence: { tier: "medium", summary: "v1 baseline draft.", reasons: [] },
    angle: "Web intent angle.", signals: [],
    draft: { subject: "Docs activity follow-up", body: "Hi Sam,\n\nSaw your team researching deployment docs…\n\nBest," },
    feedback: { edited: true, editorNote: "CTA was too aggressive." },
    outcome: { replied: true, positive: false },
    timestamps: { created: daysAgo(50), updated: daysAgo(49) },
  },
  {
    id: "job-hist-v1-03",
    lead: { name: "Dana Reyes", title: "VP Product" },
    company: "Meridian Cloud",
    play: "Event Signal",
    researchRun: researchRun({
      label: "Historical send record",
      leadSource: "Marketing event scan",
      scope: "v1 baseline draft — shipped clean but no reply.",
      contactsScanned: 1, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Event attendance context.", whyNow: "Attended Vercel launch event.",
      uncertainty: "Low.", sourceSummary: [{ label: "Event context", count: 1 }],
      candidateComparisons: [], angleDecisions: [],
    }),
    angleType: "event_signal",
    status: "sent_stub",
    pipelineStage: "complete",
    governance: "review_required",
    confidence: { tier: "low", summary: "v1 baseline draft.", reasons: [] },
    angle: "Event follow-up angle.", signals: [],
    draft: { subject: "Following up after the event", body: "Hi Dana,\n\nGreat to see Meridian at the event…\n\nBest," },
    feedback: { edited: false },
    outcome: { replied: false, positive: false },
    timestamps: { created: daysAgo(45), updated: daysAgo(44) },
  },
  // v2 bucket — lower edit rate, one positive reply
  {
    id: "job-hist-v2-01",
    lead: { name: "Morgan Ellis", title: "Director of Infrastructure" },
    company: "Prism Data",
    play: "PLG Signup",
    researchRun: researchRun({
      label: "Historical send record",
      leadSource: "Product-qualified signup",
      scope: "v2 draft — shipped clean, got a positive reply.",
      contactsScanned: 1, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Strong PLG activation signal.", whyNow: "Trial with heavy preview usage.",
      uncertainty: "Low.", sourceSummary: [{ label: "Workspace activation", count: 7 }],
      candidateComparisons: [], angleDecisions: [],
    }),
    angleType: "trial_activation",
    status: "sent_stub",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidence: { tier: "high", summary: "v2 compile draft.", reasons: [] },
    angle: "Trial activation angle.", signals: [],
    draft: { subject: "Preview workflow scale-up", body: "Hi Morgan,\n\nYour team's preview activity looks like serious scale-up territory…\n\nBest," },
    feedback: { edited: false },
    outcome: { replied: true, positive: true },
    timestamps: { created: daysAgo(30), updated: daysAgo(28) },
  },
  {
    id: "job-hist-v2-02",
    lead: { name: "Casey Liu", title: "Staff Engineer" },
    company: "Hollow Tree",
    play: "Tech Migration",
    researchRun: researchRun({
      label: "Historical send record",
      leadSource: "Outbound account list",
      scope: "v2 draft — minor edit before send.",
      contactsScanned: 1, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Tech migration context.", whyNow: "Infra role open, migration signals present.",
      uncertainty: "Moderate.", sourceSummary: [{ label: "Tech migration signals", count: 3 }],
      candidateComparisons: [], angleDecisions: [],
    }),
    angleType: "tech_migration",
    status: "sent_stub",
    pipelineStage: "complete",
    governance: "review_required",
    confidence: { tier: "medium", summary: "v2 compile draft.", reasons: [] },
    angle: "Tech migration angle.", signals: [],
    draft: { subject: "Migration timing for Hollow Tree", body: "Hi Casey,\n\nSaw the infra migration signals…\n\nBest," },
    feedback: { edited: true, editorNote: "Adjusted specifics of migration context." },
    outcome: { replied: false, positive: false },
    timestamps: { created: daysAgo(25), updated: daysAgo(24) },
  },
];

function normalizeLeadSource(raw: string): LeadSource {
  const value = raw.toLowerCase();
  if (value.includes("trial") || value.includes("product")) return "plg_product";
  if (value.includes("event")) return "marketing_event_scan";
  if (value.includes("social")) return "social_listening";
  if (value.includes("web")) return "web_deanonymization";
  if (value.includes("inbound")) return "inbound_request";
  return "crm_outbound";
}

function normalizePlayType(label: string): PlayType {
  const value = label.toLowerCase();
  if (value.includes("plg") || value.includes("trial")) return "plg_signup";
  if (value.includes("event")) return "event";
  if (value.includes("hiring")) return "hiring_signal";
  if (value.includes("tech")) return "tech_migration";
  if (value.includes("web")) return "web_intent";
  if (value.includes("social")) return "social_post";
  return "outbound_prospecting";
}

function normalizePlay(play: string, leadSource: string): Play {
  return {
    type: normalizePlayType(play),
    label: play,
    leadSource: normalizeLeadSource(leadSource),
  };
}

function normalizeResearchRun(run: LegacyResearchRun): OutboundJob["researchRun"] {
  return {
    orchestratorSummary: run.scope,
    threadSummaries: [
      `Selection: ${run.whyChosen}`,
      ...run.sourceSummary.map((source) => {
        const count = source.count != null ? `${source.count} signals` : "Signals captured";
        return `${source.label}: ${count}${source.note ? ` — ${source.note}` : ""}`;
      }),
    ],
    uncertainty: run.uncertainty,
    reports: run.sourceSummary.map((source) => ({
      topic: source.label,
      findings: [],
      gaps: source.note ? [source.note] : [],
      summary: source.note ?? `${source.count ?? 0} source signals in legacy mock data.`,
    })),
  };
}

export const MOCK_JOBS: OutboundJob[] = [...LEGACY_MOCK_JOBS, ...HISTORICAL_SENT_JOBS].map((job) => ({
  ...job,
  play: normalizePlay(job.play, job.researchRun.leadSource),
  whyNow: job.researchRun.whyNow,
  researchRun: normalizeResearchRun(job.researchRun),
  promptVersions: JOB_PROMPT_VERSIONS[job.id] ?? DSPY_PROMPT_VERSIONS_V3,
}));
