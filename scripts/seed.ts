/**
 * Seed script — writes 20 synthetic outbound jobs to InstantDB.
 * Run: npx tsx scripts/seed.ts
 *
 * Designed for: Manager, Sales Development – Commercial (50-500 employee tech companies)
 * Mix: trial_activation, hiring_signal, tech_migration, event_signal, web_intent, social_post
 */

import { init_experimental, id as genId } from "@instantdb/admin";

const APP_ID = "52c6a678-6f76-4082-ae80-b3c7a65a9216";
const ADMIN_TOKEN = "ea8be4bf-9a21-4943-8824-b9df13ac9a9d";

const db = init_experimental({ appId: APP_ID, adminToken: ADMIN_TOKEN });

const now = Date.now();
const daysAgo = (d: number) => now - d * 86400000;
const hoursAgo = (h: number) => now - h * 3600000;

type JobSeed = {
  leadName: string;
  leadTitle: string;
  company: string;
  play: string;
  angleType: string;
  status: string;
  pipelineStage: string;
  governance: string;
  confidenceTier: string;
  confidenceSummary: string;
  confidenceReasons: string[];
  angle: string;
  draftSubject: string;
  draftBody: string;
  highlightedSpan: string | null;
  signals: object[];
  discardedSignals: object[];
  researchRun: object;
  feedback: object | null;
  outcome: object | null;
  promptVersions?: Record<string, string> | null;
  createdAt: number;
  updatedAt: number;
  approvedAt?: number | null;
  archivedAt?: number | null;
  sentAt?: number | null;
  respondedAt?: number | null;
};

const LIVE_PROMPT_VERSIONS_V2 = {
  researchOrchestrator: "2026-02-17.research-orchestrator.v1",
  researchThread: "2026-02-17.research-thread.v1",
  signalExtractor: "2026-02-17.signal-extractor.v1",
  anglePlanner: "2026-02-17.angle-planner.v2",
  draftGenerator: "2026-02-17.draft-generator.v2",
} satisfies Record<string, string>;

const jobs: JobSeed[] = [
  // ─── 1. trial_activation · review_required · high ───────────────────────
  {
    leadName: "Jordan Mehta",
    leadTitle: "Head of Platform Engineering",
    company: "Clearbit",
    play: "PLG Trial",
    angleType: "trial_activation",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "review_required",
    confidenceTier: "high",
    confidenceSummary: "Workspace is 6 days old with 18 preview deploys and 4 teammates invited. Strong product-qualified signal.",
    confidenceReasons: [
      "Workspace created 6 days ago — 18 preview deployments, 4 teammates added.",
      "Two active projects show consistent deploy cadence across branches.",
      "Clearbit's open 'Infrastructure Lead' role lists preview environments and edge routing as explicit requirements.",
    ],
    angle: "Clearbit's trial activity maps to a team trying to standardize preview environments across multiple repos — the right opening is showing them how peers at similar scale have done this cleanly.",
    draftSubject: "Clearbit's preview setup — a couple things worth knowing",
    draftBody: `Hi Jordan,

Noticed Clearbit's workspace crossed 18 preview deploys in the last week with four teammates in the loop — that's a pattern we see right before teams hit coordination overhead on shared preview URLs.

A few companies at your stage (Retool, Linear, Incident.io come to mind) have found it useful to set branch-based preview policies early, before the repo count grows. Happy to show you what that looks like in practice — takes about 20 minutes.

Worth a quick call this week?

— Alex`,
    highlightedSpan: "crossed 18 preview deploys in the last week with four teammates in the loop",
    signals: [
      {
        id: "s1-1", category: "internal", label: "Workspace activation", value: "18 preview deployments, 4 teammates invited, 2 active projects in 6 days.", source: "internal", rank: 1, strength: "strong", usedInAngle: true,
      },
      {
        id: "s1-2", category: "hiring_signal", label: "Infrastructure Lead role", value: "Job listing explicitly mentions preview environments and edge routing as core requirements.", source: "external", rank: 2, strength: "strong", usedInAngle: true, evidenceUrl: "https://clearbit.com/careers/infra-lead",
      },
    ],
    discardedSignals: [{ label: "LinkedIn post about Vercel DX", reason: "Too generic — everyone mentions DX." }],
    researchRun: {
      label: "PLG trial enrichment",
      leadSource: "Product-qualified trial",
      scope: "Enriched trial workspace data with hiring signals.",
      contactsScanned: 2, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Jordan owns the platform org and is the likeliest buyer.",
      whyNow: "Active trial with a fast-growing team footprint in the workspace.",
      uncertainty: "Unclear if Jordan or a VP of Eng owns the final vendor decision.",
      sourceSummary: [{ label: "Workspace events", count: 18 }, { label: "Hiring signals", count: 1 }],
      candidateComparisons: [],
      angleDecisions: [
        { angleType: "trial_activation", summary: "Lead with workspace momentum.", selected: true, reason: "Most specific and least invasive hook." },
        { angleType: "hiring_signal", summary: "Lead with the infra role.", selected: false, reason: "Good support but weaker as opener." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: hoursAgo(4), updatedAt: hoursAgo(4),
  },

  // ─── 2. hiring_signal · auto_eligible · high ────────────────────────────
  {
    leadName: "Priya Nair",
    leadTitle: "VP Engineering",
    company: "Brex",
    play: "Hiring signal",
    angleType: "hiring_signal",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidenceTier: "high",
    confidenceSummary: "Four open frontend/platform roles with explicit Vercel-adjacent requirements. Clear expansion play.",
    confidenceReasons: [
      "Four active job listings: 2 Senior Frontend, 1 Platform, 1 DX Engineer — all mention edge deployment and preview workflows.",
      "Brex's public engineering blog referenced moving toward 'preview-first' development 3 weeks ago.",
      "No current Vercel contract in CRM — greenfield.",
    ],
    angle: "Brex is hiring fast into a preview-first workflow they've publicly committed to — the outreach should connect that hiring intent to what Vercel makes operationally tractable at their scale.",
    draftSubject: "Brex's preview-first push — what makes it stick at scale",
    draftBody: `Hi Priya,

Saw the DX Engineer and Platform roles Brex just opened — the language around preview workflows and edge delivery maps closely to what we help teams get right before the hiring wave lands.

Companies hiring that fast into platform roles often find that the workflow scaffolding hasn't caught up to the headcount. We've helped a few fintech teams (Mercury, Ramp) get their preview environment policies set up ahead of scale so the new hires land in a clean system.

Would it be useful to see how that looks in practice?

— Alex`,
    highlightedSpan: "workflow scaffolding hasn't caught up to the headcount",
    signals: [
      { id: "s2-1", category: "hiring_signal", label: "DX and Platform roles open", value: "4 roles listing preview workflows and edge deployment as explicit requirements.", source: "external", rank: 1, strength: "strong", usedInAngle: true },
      { id: "s2-2", category: "social", label: "Engineering blog: preview-first", value: "Brex eng blog post 3 weeks ago announced internal shift to preview-first development.", source: "external", rank: 2, strength: "strong", usedInAngle: true },
    ],
    discardedSignals: [],
    researchRun: {
      label: "Hiring signal enrichment", leadSource: "Outbound hiring scan",
      scope: "Found 4 roles with strong Vercel-adjacent signal on LinkedIn and Brex careers.", contactsScanned: 3, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Priya owns the eng org and is likely the exec sponsor for tooling decisions.",
      whyNow: "Hiring wave in progress — tooling decisions made now will onboard those hires.",
      uncertainty: "May already have an internal platform team evaluating Vercel.",
      sourceSummary: [{ label: "Job listings", count: 4 }, { label: "Blog signals", count: 1 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "hiring_signal", summary: "Lead with hiring + workflow readiness.", selected: true, reason: "Specific to their public intent." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: hoursAgo(6), updatedAt: hoursAgo(6),
  },

  // ─── 3. tech_migration · review_required · medium ───────────────────────
  {
    leadName: "Sam Torres",
    leadTitle: "Director of Engineering",
    company: "Loom",
    play: "Tech migration",
    angleType: "tech_migration",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "review_required",
    confidenceTier: "medium",
    confidenceSummary: "Loom's careers page and two engineering posts suggest a Netlify-to-Vercel evaluation is in progress. Not confirmed.",
    confidenceReasons: [
      "Loom's careers page shows 'familiarity with Vercel or similar platforms' as a requirement — Netlify was listed 6 months ago.",
      "One engineer's GitHub profile moved from Netlify to Vercel projects in the past quarter.",
      "No direct product signal — inferred from public footprint.",
    ],
    angle: "Loom appears to be evaluating or already using Vercel alongside Netlify — the outreach should acknowledge their likely evaluation context and make the migration path feel low-risk.",
    draftSubject: "Loom's frontend deployment setup — worth a quick sync?",
    draftBody: `Hi Sam,

Doing some research on Loom's stack and noticed your engineering roles now mention Vercel explicitly — a few months back it was Netlify. That shift often happens when teams hit deployment complexity that Netlify wasn't designed for at scale.

If you're evaluating or already running a migration, we have a pretty clean playbook for teams at Loom's size — I can show you what the path looks like and what teams typically need to de-risk first.

15 minutes this week?

— Alex`,
    highlightedSpan: "your engineering roles now mention Vercel explicitly",
    signals: [
      { id: "s3-1", category: "hiring_signal", label: "Job listings: Vercel replaces Netlify", value: "Careers page updated to mention Vercel instead of Netlify in the past 2 months.", source: "external", rank: 1, strength: "moderate", usedInAngle: true },
      { id: "s3-2", category: "tech_stack", label: "Engineer GitHub activity", value: "One senior engineer's public projects shifted from Netlify to Vercel repos.", source: "external", rank: 2, strength: "moderate", usedInAngle: true },
    ],
    discardedSignals: [{ label: "ProductHunt upvote on Vercel post", reason: "Too weak — no company attribution." }],
    researchRun: {
      label: "Tech migration signal scan", leadSource: "Outbound stack scan",
      scope: "Scanned job listings and GitHub for migration signals.", contactsScanned: 4, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Sam owns engineering and is the likely decision-maker for deployment tooling.",
      whyNow: "Signal is fresh — job listing updated in the past 8 weeks.",
      uncertainty: "Migration may already be complete; we might be late. Review required.",
      sourceSummary: [{ label: "Job listings", count: 2 }, { label: "GitHub signals", count: 1 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "tech_migration", summary: "Reference the Netlify→Vercel signal directly.", selected: true, reason: "Specific and timely." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: hoursAgo(8), updatedAt: hoursAgo(8),
  },

  // ─── 4. event_signal · review_required · high ───────────────────────────
  {
    leadName: "Marcus Webb",
    leadTitle: "Engineering Manager, Frontend Platform",
    company: "Figma",
    play: "Event attendance",
    angleType: "event_signal",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "review_required",
    confidenceTier: "high",
    confidenceSummary: "Attended Vercel Ship and registered for a preview workflows workshop. Direct product interest.",
    confidenceReasons: [
      "Marcus registered for Vercel Ship 2024 and attended the preview environments breakout.",
      "Also registered for the follow-up 'preview at scale' workshop 2 weeks later.",
      "Figma uses Netlify for some properties — potential expansion or evaluation.",
    ],
    angle: "Marcus has self-selected into Vercel preview workflow content twice — the best first touch connects that specific interest to what Figma's platform team is likely trying to solve.",
    draftSubject: "Following up on the preview workflows session",
    draftBody: `Hi Marcus,

Saw you at the Ship preview environments session — and then the follow-up workshop. That's a pretty clear signal that previews are a live problem for your team.

I work with platform engineering teams at companies like Figma's size on exactly this. Would be happy to share what we've seen work for teams managing previews across a large number of repos and contributors.

Worth 20 minutes?

— Alex`,
    highlightedSpan: "Saw you at the Ship preview environments session — and then the follow-up workshop",
    signals: [
      { id: "s4-1", category: "event", label: "Vercel Ship: preview breakout", value: "Registered and attended the preview environments session at Vercel Ship 2024.", source: "internal", rank: 1, strength: "strong", usedInAngle: true },
      { id: "s4-2", category: "event", label: "Preview at Scale workshop", value: "Registered for follow-up workshop 2 weeks post-Ship.", source: "internal", rank: 2, strength: "strong", usedInAngle: true },
    ],
    discardedSignals: [],
    researchRun: {
      label: "Event signal enrichment", leadSource: "Event registration list",
      scope: "Cross-referenced event registrations with company and role data.", contactsScanned: 1, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Marcus is directly in the decision space — platform engineering manager.",
      whyNow: "Workshop was 2 weeks ago — memory is still fresh.",
      uncertainty: "Unclear if Figma has a broader eval underway or Marcus is personally exploring.",
      sourceSummary: [{ label: "Event registrations", count: 2 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "event_signal", summary: "Reference the back-to-back event attendance.", selected: true, reason: "Hard to misconstrue — he showed up twice." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: hoursAgo(10), updatedAt: hoursAgo(10),
  },

  // ─── 5. trial_activation · auto_eligible · high ─────────────────────────
  {
    leadName: "Elena Vasquez",
    leadTitle: "CTO",
    company: "Ramp",
    play: "PLG Trial",
    angleType: "trial_activation",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidenceTier: "high",
    confidenceSummary: "Ramp's trial shows 31 deploys in 5 days, 6 teammates, and a custom domain configured. Fastest activation in cohort.",
    confidenceReasons: [
      "31 preview deployments in 5 days — fastest activation in the current 30-day cohort.",
      "Custom domain configured on day 2 — strong intent to move beyond evaluation.",
      "6 teammates invited including two senior engineers.",
    ],
    angle: "Ramp's trial engagement pattern suggests this isn't a casual evaluation — someone is driving this with urgency. The right first touch acknowledges the speed and makes it easy to talk about what they're trying to achieve.",
    draftSubject: "Ramp's Vercel usage — moving fast for a reason?",
    draftBody: `Hi Elena,

Ramp's workspace is moving faster than almost any trial we've seen recently — 31 deploys in 5 days, custom domain set up on day 2, six teammates in the loop already.

That kind of activation usually means there's a real project behind it. Happy to skip the standard onboarding and go straight to whatever problem you're trying to solve.

What's driving the urgency?

— Alex`,
    highlightedSpan: "31 deploys in 5 days, custom domain set up on day 2",
    signals: [
      { id: "s5-1", category: "internal", label: "Rapid trial activation", value: "31 preview deployments, custom domain configured day 2, 6 teammates invited in 5 days.", source: "internal", rank: 1, strength: "strong", usedInAngle: true },
    ],
    discardedSignals: [],
    researchRun: {
      label: "PLG trial enrichment", leadSource: "Product-qualified trial",
      scope: "Reviewed workspace activation data.", contactsScanned: 1, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Elena is CTO — she's driving or aware of this evaluation.",
      whyNow: "Trial is actively in progress.",
      uncertainty: "May have a direct evaluation lead below Elena we should also contact.",
      sourceSummary: [{ label: "Workspace events", count: 31 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "trial_activation", summary: "Lead with the unusual activation speed.", selected: true, reason: "The data itself is the hook." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: hoursAgo(2), updatedAt: hoursAgo(2),
  },

  // ─── 6. web_intent · review_required · medium ───────────────────────────
  {
    leadName: "Dominic Park",
    leadTitle: "Director of Product Engineering",
    company: "Intercom",
    play: "Web intent",
    angleType: "web_intent",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "review_required",
    confidenceTier: "medium",
    confidenceSummary: "Multiple Intercom IPs visited the enterprise pricing page and changelog three times this week. Not directly attributed to Dominic.",
    confidenceReasons: [
      "3 Intercom IP visits to the enterprise pricing page in 4 days.",
      "Also visited the 'Conformance' and 'DX Platform' product pages.",
      "Dominic is the most senior product engineering leader — likely buyer profile.",
    ],
    angle: "Someone at Intercom is researching Vercel enterprise capabilities — reaching out to Dominic as the most likely buyer allows us to get ahead of any formal RFP or competitive eval.",
    draftSubject: "Vercel for Intercom's engineering team",
    draftBody: `Hi Dominic,

I noticed some activity from Intercom on our enterprise pages this week — pricing, Conformance, the DX platform overview. That combination usually means someone is asking 'what does Vercel look like at our scale.'

Happy to answer that directly rather than having you piece it together from docs. We work with a few companies at Intercom's size (Zendesk, HubSpot) and there are a handful of patterns that tend to matter most.

Worth a 20-minute call?

— Alex`,
    highlightedSpan: "pricing, Conformance, the DX platform overview",
    signals: [
      { id: "s6-1", category: "web_activity", label: "Enterprise pricing page visits", value: "3 visits from Intercom IP to enterprise pricing in 4 days.", source: "internal", rank: 1, strength: "moderate", usedInAngle: true },
      { id: "s6-2", category: "web_activity", label: "DX Platform + Conformance pages", value: "Also visited Conformance and DX Platform product pages in the same session.", source: "internal", rank: 2, strength: "moderate", usedInAngle: true },
    ],
    discardedSignals: [{ label: "Docs page visits", reason: "Too broad — likely developer-level, not buyer research." }],
    researchRun: {
      label: "Web intent enrichment", leadSource: "Reverse-IP web intent",
      scope: "Matched Intercom IP to company, identified most likely buyer.", contactsScanned: 5, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Dominic is the senior-most product engineering leader at Intercom.",
      whyNow: "Recency matters — web activity was this week.",
      uncertainty: "Web intent is IP-based — could be any employee, not necessarily Dominic.",
      sourceSummary: [{ label: "Web intent events", count: 3 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "web_intent", summary: "Acknowledge the research pattern, offer to answer directly.", selected: true, reason: "Non-invasive way to surface the signal." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: hoursAgo(12), updatedAt: hoursAgo(12),
  },

  // ─── 7. social_post · auto_eligible · high ──────────────────────────────
  {
    leadName: "Aisha Okafor",
    leadTitle: "Staff Engineer",
    company: "Notion",
    play: "Social signal",
    angleType: "social_post",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidenceTier: "high",
    confidenceSummary: "Aisha posted a detailed Twitter thread about Notion's preview environment pain with a direct ask for recommendations. 340 engagements.",
    confidenceReasons: [
      "Posted a 7-tweet thread about 'preview environment hell at scale' — got 340 engagements.",
      "Explicitly asked for vendor recommendations in the final tweet.",
      "Notion is currently on a mix of Netlify and custom infra — potential migration.",
    ],
    angle: "Aisha publicly asked for help with the exact problem Vercel solves — the first touch should feel like a direct and useful answer to her public question, not a cold pitch.",
    draftSubject: "Re: your preview environment thread",
    draftBody: `Hi Aisha,

Saw your thread about preview environment pain at scale — the 'every PR gets its own URL but no one knows which one is current' problem is something we've worked on a lot.

We added branch-based preview policies, deployment protection, and team-scoped environments specifically because teams at Notion's scale hit exactly what you described. Happy to show you the specifics — it's faster than a doc.

Want me to send over a 10-minute walkthrough or jump on a call?

— Alex`,
    highlightedSpan: "'preview environment hell at scale'",
    signals: [
      { id: "s7-1", category: "social", label: "Twitter thread: preview env pain", value: "7-tweet thread about preview environment pain at scale, 340 engagements, explicit ask for vendor recs.", source: "external", rank: 1, strength: "strong", usedInAngle: true },
    ],
    discardedSignals: [],
    researchRun: {
      label: "Social signal enrichment", leadSource: "Social monitoring",
      scope: "Identified Aisha's thread via keyword monitoring on 'preview environment'.", contactsScanned: 1, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Aisha directly asked for recommendations — she's the active evaluator.",
      whyNow: "Thread is 3 days old — window is closing.",
      uncertainty: "Staff engineer may not control vendor decisions; may need to involve an EM.",
      sourceSummary: [{ label: "Social signals", count: 1 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "social_post", summary: "Reply directly to the public ask.", selected: true, reason: "She invited responses — this is the most natural entry." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: hoursAgo(3), updatedAt: hoursAgo(3),
  },

  // ─── 8. tech_migration · review_required · medium ───────────────────────
  {
    leadName: "Chris Nakamura",
    leadTitle: "Principal Engineer",
    company: "Asana",
    play: "Tech migration",
    angleType: "tech_migration",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "review_required",
    confidenceTier: "medium",
    confidenceSummary: "Asana's package.json shows a recent Next.js upgrade from 12 to 14. Migration context likely.",
    confidenceReasons: [
      "Public GitHub repo shows Next.js version bump from 12 to 14 in a PR merged 3 weeks ago.",
      "App Router migration pattern visible in repo structure changes.",
      "Asana currently deploys to AWS — upgrading Next.js often triggers a deployment re-evaluation.",
    ],
    angle: "Asana's Next.js 14 + App Router migration is the kind of project that exposes deployment infrastructure limitations — the right touch connects the version bump to the hosting conversation.",
    draftSubject: "Asana's Next.js 14 upgrade — hosting implications worth knowing",
    draftBody: `Hi Chris,

Noticed Asana recently shipped the Next.js 14 upgrade with App Router. That migration tends to surface deployment questions that weren't there on 12 — Server Components, streaming, and partial prerendering all behave differently depending on where you're hosting.

We've helped a few teams do this migration cleanly and avoid rebuilding their CI/CD setup later. Happy to share what the diff usually looks like.

Quick call this week?

— Alex`,
    highlightedSpan: "Next.js 14 upgrade with App Router",
    signals: [
      { id: "s8-1", category: "tech_stack", label: "Next.js 12 → 14 upgrade", value: "Merged PR upgrading Next.js from 12 to 14 with App Router adoption 3 weeks ago.", source: "external", rank: 1, strength: "moderate", usedInAngle: true },
      { id: "s8-2", category: "tech_stack", label: "AWS hosting currently", value: "Asana's frontend is deployed on AWS — no current Vercel relationship.", source: "derived", rank: 2, strength: "moderate", usedInAngle: true },
    ],
    discardedSignals: [],
    researchRun: {
      label: "Tech stack scan", leadSource: "GitHub public repo scan",
      scope: "Scanned public Asana repos for Next.js version and deployment signals.", contactsScanned: 3, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Chris is a principal engineer — likely driving or deeply involved in the migration.",
      whyNow: "Migration is fresh — 3 weeks post-merge.",
      uncertainty: "Asana may have an internal platform team that owns hosting decisions independently.",
      sourceSummary: [{ label: "GitHub PRs", count: 1 }, { label: "Stack signals", count: 2 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "tech_migration", summary: "Connect the Next.js upgrade to the hosting question.", selected: true, reason: "Most technically relevant hook for a principal engineer." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: daysAgo(1), updatedAt: daysAgo(1),
  },

  // ─── 9. hiring_signal · review_required · high ──────────────────────────
  {
    leadName: "Fatima Al-Hassan",
    leadTitle: "VP of Product",
    company: "Lattice",
    play: "Hiring signal",
    angleType: "hiring_signal",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "review_required",
    confidenceTier: "high",
    confidenceSummary: "Lattice is hiring a 'Frontend Platform Engineer' with explicit Vercel experience listed — strong expansion signal.",
    confidenceReasons: [
      "Job listing for Frontend Platform Engineer lists 'Vercel or similar platform experience' as required.",
      "Lattice currently has no Vercel contract — this is likely a net-new procurement.",
      "VP of Product is the most likely executive sponsor for tooling that touches developer experience.",
    ],
    angle: "Lattice is hiring specifically for Vercel skills, which typically signals an evaluation or early adoption in progress — reaching out now means we can be part of shaping that implementation rather than responding to an RFP.",
    draftSubject: "Lattice's frontend platform role — Vercel context",
    draftBody: `Hi Fatima,

Saw Lattice is hiring a Frontend Platform Engineer with Vercel experience listed as a requirement. That usually means either an evaluation is already underway or someone on the team has started pushing for it.

If you're building toward Vercel-based infrastructure, I'd rather have that conversation now than after the role is filled — we work best when we're involved before the architecture is locked in.

Worth a quick call?

— Alex`,
    highlightedSpan: "Vercel experience listed as a requirement",
    signals: [
      { id: "s9-1", category: "hiring_signal", label: "Frontend Platform role: Vercel required", value: "Job listing explicitly requires Vercel experience — first time in Lattice's job history.", source: "external", rank: 1, strength: "strong", usedInAngle: true },
    ],
    discardedSignals: [],
    researchRun: {
      label: "Hiring signal scan", leadSource: "Outbound hiring scan",
      scope: "Identified Vercel-specific job listings.", contactsScanned: 2, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Fatima is VP of Product — most likely exec sponsor for developer experience investments.",
      whyNow: "Listing is live now — pre-hire is the best time to engage.",
      uncertainty: "May be targeting an existing Vercel user as a hire, not building from scratch.",
      sourceSummary: [{ label: "Job listings", count: 1 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "hiring_signal", summary: "Engage before the hire is made.", selected: true, reason: "Pre-hire window is the highest leverage moment." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: daysAgo(1), updatedAt: daysAgo(1),
  },

  // ─── 10. trial_activation · auto_eligible · high ────────────────────────
  {
    leadName: "James Okonkwo",
    leadTitle: "Head of Engineering",
    company: "Coda",
    play: "PLG Trial",
    angleType: "trial_activation",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidenceTier: "high",
    confidenceSummary: "Coda trial has 3 projects and a CI integration set up in 48 hours. Strong buy signal.",
    confidenceReasons: [
      "3 projects created, CI integration configured, and 12 deploys in 48 hours.",
      "Trial workspace includes a production-like domain pattern — not just exploration.",
      "Coda has no existing Vercel relationship in CRM.",
    ],
    angle: "Coda's trial setup looks like someone moving fast toward a production decision — the right touch is meeting that urgency and helping them skip past the evaluation phase.",
    draftSubject: "Coda's Vercel setup — moving toward production?",
    draftBody: `Hi James,

Coda's workspace shows 3 projects, CI wired up, and 12 deploys in 48 hours — that's a production migration pace, not a casual trial.

If you're on a timeline, I'd rather help you move faster than leave you to figure out the edge cases on your own. We've run a few migrations at Coda's scale and there are a handful of decisions worth making early.

What's your target date?

— Alex`,
    highlightedSpan: "3 projects, CI wired up, and 12 deploys in 48 hours",
    signals: [
      { id: "s10-1", category: "internal", label: "Fast trial activation", value: "3 projects, CI integration, 12 deploys in 48 hours.", source: "internal", rank: 1, strength: "strong", usedInAngle: true },
    ],
    discardedSignals: [],
    researchRun: {
      label: "PLG trial enrichment", leadSource: "Product-qualified trial",
      scope: "Reviewed trial workspace velocity.", contactsScanned: 1, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "James is Head of Engineering — he'd own this decision.",
      whyNow: "Fast-moving trial suggests a real deadline.",
      uncertainty: "Could be a single engineer running a POC without org-level buy-in.",
      sourceSummary: [{ label: "Workspace events", count: 12 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "trial_activation", summary: "Lead with the velocity and ask about timeline.", selected: true, reason: "Urgency as an opener is appropriate when the data justifies it." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: daysAgo(2), updatedAt: daysAgo(2),
  },

  // ─── 11. event_signal · auto_eligible · high · approved ─────────────────
  {
    leadName: "Rachel Kim",
    leadTitle: "Engineering Manager",
    company: "Linear",
    play: "Event attendance",
    angleType: "event_signal",
    status: "approved",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidenceTier: "high",
    confidenceSummary: "Rachel attended two Vercel sessions at JSConf and has Linear on a starter plan. Clear upgrade path.",
    confidenceReasons: [
      "Attended two Vercel-hosted sessions at JSConf EU.",
      "Linear is on a Vercel Starter plan — upgrade conversation is natural.",
      "Rachel owns the engineering team — she'd drive or sponsor a plan upgrade.",
    ],
    angle: "Rachel is already in the Vercel ecosystem and attended conference sessions on advanced usage — the opener should feel like a natural 'next step' conversation, not a cold pitch.",
    draftSubject: "Linear's Vercel plan — next steps after JSConf",
    draftBody: `Hi Rachel,

Saw you at the Vercel sessions at JSConf — great turnout on the edge deployment talk.

Linear is already on Starter — curious if there are any deployment or team workflow problems that the current plan is bumping up against. Some of the teams similar to yours have found the Pro team features (branch protection, deployment policies, SSO) worth it once they hit a certain PR volume.

Happy to walk through what the upgrade looks like in practice.

— Alex`,
    highlightedSpan: "Saw you at the Vercel sessions at JSConf",
    signals: [
      { id: "s11-1", category: "event", label: "JSConf: 2 Vercel sessions", value: "Attended both Vercel-hosted sessions at JSConf EU.", source: "external", rank: 1, strength: "strong", usedInAngle: true },
      { id: "s11-2", category: "plg", label: "Active Starter plan", value: "Linear is on Vercel Starter with 3 active projects.", source: "internal", rank: 2, strength: "moderate", usedInAngle: true },
    ],
    discardedSignals: [],
    researchRun: {
      label: "Event + PLG enrichment", leadSource: "Event registration + CRM",
      scope: "Cross-referenced event attendance with existing CRM plan data.", contactsScanned: 2, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Rachel is the EM — she'd own the upgrade decision.",
      whyNow: "Post-conference window is the natural moment to follow up.",
      uncertainty: "Linear may have a separate procurement process even for software upgrades.",
      sourceSummary: [{ label: "Event signals", count: 2 }, { label: "CRM plan data", count: 1 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "event_signal", summary: "Use conference as the natural opener.", selected: true, reason: "In-person shared context makes the outreach feel warm." },
      ],
    },
    feedback: { edited: false }, outcome: null,
    createdAt: daysAgo(3), updatedAt: daysAgo(2),
  },

  // ─── 12. social_post · review_required · medium ─────────────────────────
  {
    leadName: "Tyler Nguyen",
    leadTitle: "Lead Frontend Engineer",
    company: "Webflow",
    play: "Social signal",
    angleType: "social_post",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "review_required",
    confidenceTier: "medium",
    confidenceSummary: "Tyler praised Vercel's DX in a LinkedIn post but Webflow competes with Vercel in some segments. Sensitive — needs review.",
    confidenceReasons: [
      "Tyler posted on LinkedIn: 'Vercel has the best DX in the business — I wish we built more on it'.",
      "Webflow has a partial competitive dynamic with Vercel — approach needs to be collaborative, not aggressive.",
      "Tyler is a practitioner, not a decision-maker — needs to be routed carefully.",
    ],
    angle: "Tyler is a Vercel advocate inside a company with a complex Vercel relationship — the right touch is developer-to-developer, focused on what Webflow could build on Vercel rather than positioning against Webflow's product.",
    draftSubject: "Your LinkedIn post — Vercel + Webflow",
    draftBody: `Hi Tyler,

Saw your post about Vercel's DX — appreciate the kind words. I know the Webflow / Vercel relationship is nuanced, but some of the best work we've seen is Webflow teams using Vercel for the parts that sit outside the core CMS: custom storefronts, edge middleware, headless tooling.

If there are internal projects that would benefit from that, happy to explore whether there's a natural fit — no competitive weirdness required.

— Alex`,
    highlightedSpan: "'Vercel has the best DX in the business — I wish we built more on it'",
    signals: [
      { id: "s12-1", category: "social", label: "LinkedIn: Vercel DX praise", value: "Tyler posted publicly praising Vercel's DX and expressing interest in building on it.", source: "external", rank: 1, strength: "moderate", usedInAngle: true },
    ],
    discardedSignals: [{ label: "Webflow product competitor mentions", reason: "Not useful — too adversarial to reference." }],
    researchRun: {
      label: "Social signal enrichment", leadSource: "Social monitoring",
      scope: "Flagged post due to competitive context — review required.", contactsScanned: 1, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Tyler is the advocate inside the account.",
      whyNow: "Post is 5 days old — act while it's fresh.",
      uncertainty: "Competitive context means this needs careful handling — review required before send.",
      sourceSummary: [{ label: "Social signals", count: 1 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "social_post", summary: "Acknowledge the post, stay collaborative.", selected: true, reason: "Developer-to-developer tone disarms the competitive dynamic." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: daysAgo(2), updatedAt: daysAgo(2),
  },

  // ─── 13. tech_migration · auto_eligible · high ──────────────────────────
  {
    leadName: "Megan Strauss",
    leadTitle: "Director, Engineering",
    company: "Airtable",
    play: "Tech migration",
    angleType: "tech_migration",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidenceTier: "high",
    confidenceSummary: "Airtable's public eng blog announced a migration from a custom webpack setup to Next.js — Vercel is the natural deployment destination.",
    confidenceReasons: [
      "Airtable engineering blog announced Next.js migration 6 weeks ago.",
      "The post explicitly mentioned 'evaluating hosting options' as a next step.",
      "Megan is listed as the migration DRI in the blog post.",
    ],
    angle: "Airtable is in the middle of a Next.js migration and their engineering team is publicly evaluating hosting — Vercel should be in that conversation now, not after the decision is made.",
    draftSubject: "Airtable's Next.js migration — hosting evaluation",
    draftBody: `Hi Megan,

Read your engineering blog post on the webpack → Next.js migration — great write-up. You mentioned evaluating hosting as a next step.

Given the migration scope, I'd love to walk you through what Vercel looks like purpose-built for Next.js at Airtable's scale — specifically around incremental adoption, monorepo support, and preview infrastructure.

15 minutes this week?

— Alex`,
    highlightedSpan: "webpack → Next.js migration — great write-up",
    signals: [
      { id: "s13-1", category: "tech_stack", label: "Eng blog: Next.js migration", value: "Airtable engineering blog announced migration from custom webpack to Next.js 6 weeks ago.", source: "external", rank: 1, strength: "strong", usedInAngle: true },
      { id: "s13-2", category: "social", label: "Blog: 'evaluating hosting options'", value: "Post explicitly mentions evaluating hosting as the next step in the migration.", source: "external", rank: 2, strength: "strong", usedInAngle: true },
    ],
    discardedSignals: [],
    researchRun: {
      label: "Tech migration scan", leadSource: "Engineering blog monitoring",
      scope: "Identified migration announcement and confirmed Megan as DRI.", contactsScanned: 2, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Megan is the DRI named in the post — she owns this decision.",
      whyNow: "6 weeks into a migration — hosting decision window is open now.",
      uncertainty: "May have already shortlisted vendors or started a formal RFP.",
      sourceSummary: [{ label: "Blog posts", count: 1 }, { label: "LinkedIn signals", count: 1 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "tech_migration", summary: "Reference the blog post directly and offer a migration walkthrough.", selected: true, reason: "Public content makes the outreach feel warm and informed." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: daysAgo(3), updatedAt: daysAgo(3),
  },

  // ─── 14. web_intent · auto_eligible · medium ────────────────────────────
  {
    leadName: "David Chen",
    leadTitle: "Head of Growth Engineering",
    company: "Canva",
    play: "Web intent",
    angleType: "web_intent",
    status: "approved",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidenceTier: "medium",
    confidenceSummary: "Canva IPs visited the ISR/edge docs 4 times and the enterprise pricing page twice. Growth engineering team is the likely context.",
    confidenceReasons: [
      "4 visits from Canva IP to the ISR and Edge Runtime documentation.",
      "2 visits to enterprise pricing — suggests someone is building a business case.",
      "Growth engineering is the most likely team for ISR/edge use cases at Canva.",
    ],
    angle: "Someone on Canva's team is researching ISR and edge capabilities — likely for a growth or landing page use case. The opener should connect those technical interests to outcomes they likely care about.",
    draftSubject: "Canva's edge + ISR research",
    draftBody: `Hi David,

Noticed some research on our ISR and Edge Runtime docs from Canva this week — that combination usually shows up when a growth or marketing engineering team is trying to figure out if they can get better page performance without rebuilding their architecture.

Happy to answer that more directly than docs can. We've helped growth teams at Figma and Notion use ISR to cut page load times significantly on template/landing pages.

Worth a conversation?

— Alex`,
    highlightedSpan: "ISR and Edge Runtime docs from Canva this week",
    signals: [
      { id: "s14-1", category: "web_activity", label: "ISR + Edge docs visits", value: "4 visits from Canva IP to ISR and Edge Runtime documentation.", source: "internal", rank: 1, strength: "moderate", usedInAngle: true },
      { id: "s14-2", category: "web_activity", label: "Enterprise pricing visits", value: "2 visits to enterprise pricing page.", source: "internal", rank: 2, strength: "moderate", usedInAngle: false },
    ],
    discardedSignals: [],
    researchRun: {
      label: "Web intent enrichment", leadSource: "Reverse-IP web intent",
      scope: "Matched Canva IP and identified most likely team profile.", contactsScanned: 4, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "David heads growth engineering — the most natural match for ISR/edge research.",
      whyNow: "Web activity was this week.",
      uncertainty: "IP attribution is imperfect — might be a different team or individual.",
      sourceSummary: [{ label: "Web intent events", count: 6 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "web_intent", summary: "Reference the technical research pattern and offer to help.", selected: true, reason: "Technical content shows they're already evaluating — meet them there." },
      ],
    },
    feedback: { edited: true, editorNote: "Softened the opening — removed direct IP mention" }, outcome: null,
    createdAt: daysAgo(4), updatedAt: daysAgo(3),
  },

  // ─── 15. trial_activation · review_required · low ───────────────────────
  {
    leadName: "Brian Foster",
    leadTitle: "Software Engineer",
    company: "Dropbox",
    play: "PLG Trial",
    angleType: "trial_activation",
    status: "reviewed",
    pipelineStage: "complete",
    governance: "review_required",
    confidenceTier: "low",
    confidenceSummary: "Trial has 2 deploys in 10 days — low engagement. Contact is an IC, not a buyer. Archived.",
    confidenceReasons: [
      "Only 2 deploys in 10 days — no team activity, no domain config.",
      "Brian is an individual contributor — unlikely to be a buyer or decision-maker.",
      "Dropbox has an existing enterprise contract with a different team.",
    ],
    angle: "Low-signal trial from an IC at a company with an existing Vercel contract — not worth pursuing independently.",
    draftSubject: "Getting started with Vercel",
    draftBody: `Hi Brian,

Saw you've been exploring Vercel — happy to help if you're running into anything. We have docs and templates for most common Next.js setups.

If there's a specific project or use case you're evaluating for, let me know and I can point you to the right resources.

— Alex`,
    highlightedSpan: null,
    signals: [
      { id: "s15-1", category: "internal", label: "Low-engagement trial", value: "2 deploys in 10 days, no team invites, no domain config.", source: "internal", rank: 1, strength: "weak", usedInAngle: false },
    ],
    discardedSignals: [{ label: "Enterprise contract with another team", reason: "Separate account — don't step on existing relationship." }],
    researchRun: {
      label: "PLG trial review", leadSource: "Product-qualified trial",
      scope: "Reviewed trial engagement — flagged as low signal.", contactsScanned: 1, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Brian is the account holder.",
      whyNow: "Trial is 10 days old — check-in is appropriate.",
      uncertainty: "Separate enterprise account may be affected by contacting Brian.",
      sourceSummary: [{ label: "Workspace events", count: 2 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "trial_activation", summary: "Offer resources — don't push for a meeting.", selected: true, reason: "Low signal doesn't justify an aggressive opener." },
      ],
    },
    feedback: { edited: false }, outcome: null,
    createdAt: daysAgo(10), updatedAt: daysAgo(5),
  },

  // ─── 16. hiring_signal · auto_eligible · high ───────────────────────────
  {
    leadName: "Nina Patel",
    leadTitle: "CTO",
    company: "Rippling",
    play: "Hiring signal",
    angleType: "hiring_signal",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidenceTier: "high",
    confidenceSummary: "Rippling is hiring 3 frontend engineers specifically for a design system and component library build-out. High fit for Vercel's platform.",
    confidenceReasons: [
      "3 open roles for 'Frontend Engineer – Design System' with explicit mention of build tooling and deployment infrastructure.",
      "Rippling's engineering blog discussed moving toward a unified component library 2 months ago.",
      "No current Vercel relationship in CRM.",
    ],
    angle: "Rippling is building out a design system — that project type consistently benefits from Vercel's preview infrastructure, and reaching out now means we're part of the architectural conversation.",
    draftSubject: "Rippling's design system build — Vercel as the right foundation",
    draftBody: `Hi Nina,

Noticed Rippling is hiring into a design system and component library effort — three roles active right now. That project tends to go smoothly when the preview infrastructure is right from day one.

Design system teams we work with (Stripe, Shopify) rely heavily on per-PR preview environments to review component changes before they land in consuming apps. Happy to show you what that workflow looks like and whether it maps to where Rippling is headed.

Quick sync this week?

— Alex`,
    highlightedSpan: "per-PR preview environments to review component changes",
    signals: [
      { id: "s16-1", category: "hiring_signal", label: "3 design system engineering roles", value: "3 active frontend roles focused on design system and component library, mentioning build tooling.", source: "external", rank: 1, strength: "strong", usedInAngle: true },
      { id: "s16-2", category: "social", label: "Engineering blog: unified component library", value: "Rippling engineering blog announced component library initiative 2 months ago.", source: "external", rank: 2, strength: "strong", usedInAngle: true },
    ],
    discardedSignals: [],
    researchRun: {
      label: "Hiring signal scan", leadSource: "Outbound hiring scan",
      scope: "Identified design system hiring wave and matched to product blog.", contactsScanned: 3, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Nina is CTO — she would sponsor or be aware of a tooling decision of this scope.",
      whyNow: "Hiring is active — architectural decisions are being made right now.",
      uncertainty: "A VP of Engineering or platform lead may be the more direct contact.",
      sourceSummary: [{ label: "Job listings", count: 3 }, { label: "Blog signals", count: 1 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "hiring_signal", summary: "Connect hiring wave to preview infrastructure need.", selected: true, reason: "Design system projects are a high-fit Vercel use case." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: daysAgo(1), updatedAt: daysAgo(1),
  },

  // ─── 17. event_signal · review_required · medium ────────────────────────
  {
    leadName: "Lars Eriksson",
    leadTitle: "Principal Software Engineer",
    company: "Klarna",
    play: "Event attendance",
    angleType: "event_signal",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "review_required",
    confidenceTier: "medium",
    confidenceSummary: "Lars attended Next.js Conf but Klarna is a complex European enterprise with existing tooling. Needs review before send.",
    confidenceReasons: [
      "Registered and attended Next.js Conf — frontend track and edge computing session.",
      "Klarna is headquartered in Sweden — GDPR implications for outreach.",
      "Lars is a principal engineer, not a decision-maker.",
    ],
    angle: "Lars is technically engaged with Next.js and Vercel content but Klarna's size and European HQ means the outreach needs to be measured — the goal is to identify whether there's a team-level eval worth escalating to.",
    draftSubject: "Your Next.js Conf attendance — Vercel for Klarna?",
    draftBody: `Hi Lars,

Saw you at Next.js Conf — the edge computing session had a great turnout. Curious what brought you there from Klarna's side — whether that's personal interest or a specific project you're exploring.

If Klarna has any frontend teams evaluating Next.js or edge infrastructure, happy to connect you with the right people on our end. No pressure either way.

— Alex`,
    highlightedSpan: "Saw you at Next.js Conf",
    signals: [
      { id: "s17-1", category: "event", label: "Next.js Conf attendance", value: "Registered and attended Next.js Conf, specifically the edge computing session.", source: "internal", rank: 1, strength: "moderate", usedInAngle: true },
    ],
    discardedSignals: [{ label: "Klarna enterprise size", reason: "Enterprise complexity makes this an upmarket deal — outside commercial scope without review." }],
    researchRun: {
      label: "Event enrichment", leadSource: "Conference registration",
      scope: "Cross-referenced event attendance with company profile.", contactsScanned: 1, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Lars is the event attendee — most natural entry point.",
      whyNow: "Conference was 1 week ago.",
      uncertainty: "GDPR compliance and enterprise deal size make this a review-required case.",
      sourceSummary: [{ label: "Event registrations", count: 1 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "event_signal", summary: "Use conference as opener, qualify the account.", selected: true, reason: "Low-pressure opener appropriate for complex account." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: daysAgo(3), updatedAt: daysAgo(3),
  },

  // ─── 18. trial_activation · auto_eligible · high · sent_stub ────────────
  {
    leadName: "Sarah Mitchell",
    leadTitle: "Director of Engineering",
    company: "Retool",
    play: "PLG Trial",
    angleType: "trial_activation",
    status: "sent_stub",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidenceTier: "high",
    confidenceSummary: "Retool trial showed 22 deploys in 4 days with production domain — approved and sent.",
    confidenceReasons: [
      "22 preview deployments in 4 days.",
      "Production domain connected on day 3.",
      "Sarah is the Director of Engineering — confirmed decision-maker profile.",
    ],
    angle: "Retool's trial activation suggests a real production migration in progress — the email was approved and sent.",
    draftSubject: "Retool's Vercel usage — production timing",
    draftBody: `Hi Sarah,

Retool's workspace hit 22 deploys in 4 days with a production domain connected on day 3 — that's a real migration pace.

If you're on a timeline, I'd like to make sure you have the right support lined up for the production cutover. We've run this with a few teams your size and there are usually 2-3 configuration decisions that are worth getting right before launch.

Would it be useful to have a 20-minute call before you go live?

— Alex`,
    highlightedSpan: "22 deploys in 4 days with a production domain connected on day 3",
    signals: [
      { id: "s18-1", category: "internal", label: "Fast production-pace trial", value: "22 deploys in 4 days, production domain day 3.", source: "internal", rank: 1, strength: "strong", usedInAngle: true },
    ],
    discardedSignals: [],
    researchRun: {
      label: "PLG trial enrichment", leadSource: "Product-qualified trial",
      scope: "Reviewed trial activation velocity and confirmed contact.", contactsScanned: 1, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Sarah is Director of Engineering — confirmed decision-maker.",
      whyNow: "Production domain connected — migration imminent.",
      uncertainty: "None significant — high confidence.",
      sourceSummary: [{ label: "Workspace events", count: 22 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "trial_activation", summary: "Lead with production migration urgency.", selected: true, reason: "The domain config confirms serious intent." },
      ],
    },
    feedback: { edited: false }, outcome: { replied: true, positive: true },
    createdAt: daysAgo(5), updatedAt: daysAgo(2),
  },

  // ─── 19. tech_migration · review_required · high ────────────────────────
  {
    leadName: "Omar Hassan",
    leadTitle: "VP Engineering",
    company: "Plaid",
    play: "Tech migration",
    angleType: "tech_migration",
    status: "pending_review",
    pipelineStage: "complete",
    governance: "review_required",
    confidenceTier: "high",
    confidenceSummary: "Plaid's open-source repos show a full migration from CRA to Next.js across 3 repos in 6 weeks. Deployment conversation is wide open.",
    confidenceReasons: [
      "3 public Plaid repos migrated from Create React App to Next.js in the past 6 weeks.",
      "Migration PRs are large — this is an org-level initiative, not a single engineer experiment.",
      "Plaid currently hosts on AWS — no Vercel relationship.",
    ],
    angle: "Plaid is running a coordinated CRA-to-Next.js migration across multiple repos — this is an org-level initiative and the deployment question is about to come up. The outreach should position Vercel as the obvious next step.",
    draftSubject: "Plaid's CRA → Next.js migration — deployment next steps",
    draftBody: `Hi Omar,

Noticed Plaid's been running a CRA → Next.js migration across a few repos over the past 6 weeks — meaningful scale for an org-level initiative.

Once the migration is done, the deployment piece usually becomes the next project. Given the scope, it's worth making sure the hosting infrastructure can actually take advantage of what Next.js adds — Server Components, streaming, ISR — rather than just deploying it like a static app.

Happy to walk through what that looks like for a team at Plaid's scale.

— Alex`,
    highlightedSpan: "CRA → Next.js migration across a few repos over the past 6 weeks",
    signals: [
      { id: "s19-1", category: "tech_stack", label: "CRA → Next.js migration (3 repos)", value: "3 public repos migrated from Create React App to Next.js over 6 weeks.", source: "external", rank: 1, strength: "strong", usedInAngle: true },
      { id: "s19-2", category: "tech_stack", label: "AWS hosting, no Vercel", value: "Plaid currently deploys on AWS — no Vercel relationship in CRM.", source: "derived", rank: 2, strength: "moderate", usedInAngle: true },
    ],
    discardedSignals: [],
    researchRun: {
      label: "Tech migration scan", leadSource: "GitHub public repo monitoring",
      scope: "Identified coordinated CRA→Next.js migration across Plaid repos.", contactsScanned: 3, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Omar is VP Engineering — he would own or sponsor the deployment infrastructure decision.",
      whyNow: "Migration is in progress — deployment conversation will happen in the next 4-8 weeks.",
      uncertainty: "Plaid has strong infra team — they may build an internal hosting solution.",
      sourceSummary: [{ label: "GitHub PRs", count: 3 }, { label: "Stack signals", count: 2 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "tech_migration", summary: "Connect the migration to the deployment question.", selected: true, reason: "Deployment is the natural follow-on to a Next.js migration." },
      ],
    },
    feedback: null, outcome: null,
    createdAt: daysAgo(1), updatedAt: daysAgo(1),
  },

  // ─── 20. trial_activation · auto_eligible · high · approved ─────────────
  {
    leadName: "Zoe Blackwell",
    leadTitle: "Engineering Manager",
    company: "Figma",
    play: "PLG Trial",
    angleType: "trial_activation",
    status: "approved",
    pipelineStage: "complete",
    governance: "auto_eligible",
    confidenceTier: "high",
    confidenceSummary: "Figma's second workspace opened with 15 deploys in 3 days — separate team from the main account, possible expansion.",
    confidenceReasons: [
      "Second Figma workspace (separate from existing enterprise account) — 15 deploys in 3 days.",
      "New workspace has a different email domain pattern — likely a separate product team.",
      "Expansion within an existing enterprise account is high-close-rate opportunity.",
    ],
    angle: "A second Figma team has spun up an independent Vercel workspace — this is a natural expansion conversation with an existing customer, not a cold pitch.",
    draftSubject: "Figma's second Vercel workspace — getting set up right",
    draftBody: `Hi Zoe,

Noticed a new Figma workspace activated recently — separate from the main Figma account. 15 deploys in 3 days suggests this isn't a test.

Given that Figma already has a Vercel relationship, it might be worth connecting your workspace to the enterprise account for consolidated billing, SSO, and team policies. Happy to make that intro to the account team or sort it out directly.

— Alex`,
    highlightedSpan: "15 deploys in 3 days suggests this isn't a test",
    signals: [
      { id: "s20-1", category: "internal", label: "Second Figma workspace activated", value: "New workspace with separate email domain — 15 deploys in 3 days.", source: "internal", rank: 1, strength: "strong", usedInAngle: true },
      { id: "s20-2", category: "plg", label: "Existing enterprise account", value: "Figma has an active enterprise Vercel contract — separate account team owns it.", source: "internal", rank: 2, strength: "strong", usedInAngle: true },
    ],
    discardedSignals: [],
    researchRun: {
      label: "PLG trial enrichment", leadSource: "Product-qualified trial",
      scope: "Cross-referenced new workspace with existing CRM account data.", contactsScanned: 2, accountsTouched: 1, shortlisted: 1, selectedRank: 1,
      whyChosen: "Zoe is the workspace owner — she's the right first contact.",
      whyNow: "Expansion is highest value when caught early before the team builds habits outside enterprise guardrails.",
      uncertainty: "May need to loop in the enterprise account team — coordinate before sending.",
      sourceSummary: [{ label: "Workspace events", count: 15 }, { label: "CRM signals", count: 1 }],
      candidateComparisons: [], angleDecisions: [
        { angleType: "trial_activation", summary: "Frame as account consolidation, not a sales pitch.", selected: true, reason: "Customer expansion is more collaborative than new business outreach." },
      ],
    },
    feedback: { edited: false }, outcome: null,
    createdAt: daysAgo(4), updatedAt: daysAgo(3),
  },
];

function applyLifecycleTimestamps(job: JobSeed): JobSeed {
  if (job.status === "approved") {
    return {
      ...job,
      approvedAt: job.approvedAt ?? job.updatedAt,
    };
  }

  if (job.status === "reviewed") {
    return {
      ...job,
      archivedAt: job.archivedAt ?? job.updatedAt,
    };
  }

  if (job.status === "sent_stub") {
    const sentAt = job.sentAt ?? Math.max(job.createdAt + 12 * 3600000, job.updatedAt - 18 * 3600000);
    const respondedAt =
      job.outcome && (job.outcome as { replied?: boolean; positive?: boolean }).replied
        ? job.respondedAt ?? job.updatedAt
        : null;

    return {
      ...job,
      approvedAt: job.approvedAt ?? Math.max(job.createdAt + 4 * 3600000, sentAt - 6 * 3600000),
      sentAt,
      respondedAt,
    };
  }

  return {
    ...job,
    approvedAt: job.approvedAt ?? null,
    archivedAt: job.archivedAt ?? null,
    sentAt: job.sentAt ?? null,
    respondedAt: job.respondedAt ?? null,
  };
}

const seededJobs = jobs.map((job) => ({
  ...applyLifecycleTimestamps(job),
  promptVersions: job.promptVersions ?? LIVE_PROMPT_VERSIONS_V2,
}));

async function main() {
  console.log(`Seeding ${seededJobs.length} jobs into InstantDB app ${APP_ID}...`);

  // Clear existing jobs first
  const existing = await db.query({ jobs: {} });
  const existingJobs = existing.jobs ?? [];
  if (existingJobs.length > 0) {
    console.log(`  Clearing ${existingJobs.length} existing jobs...`);
    const deleteTxns = existingJobs.map((j: { id: string }) => db.tx.jobs[j.id].delete());
    await db.transact(deleteTxns);
    console.log("  Cleared.");
  }

  // Seed new jobs
  const txns = seededJobs.map((job) => db.tx.jobs[genId()].update(job));
  await db.transact(txns);

  console.log(`✓ Seeded ${seededJobs.length} jobs successfully.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
