import { i } from "@instantdb/react";

export default i.schema({
  entities: {
    jobs: i.entity({
      // Lead
      leadName: i.string(),
      leadTitle: i.string(),
      company: i.string(),
      play: i.json(),
      whyNow: i.string(),
      pipelineStatus: i.string(),
      // Pipeline state
      angleType: i.string(),
      status: i.string(),
      pipelineStage: i.string(),
      governance: i.string(),
      // Confidence
      confidenceTier: i.string(),
      confidenceSummary: i.string(),
      confidenceReasons: i.json(),
      // Content
      angle: i.string(),
      outreach: i.json(),
      draftSubject: i.string(),
      draftBody: i.string(),
      highlightedSpan: i.any(),
      // Rich nested data (JSON)
      signals: i.json(),
      discardedSignals: i.json(),
      researchRun: i.json(),
      // SDR actions
      feedback: i.any(),
      outcome: i.any(),
      /** Full PROMPT_VERSIONS map stamped at run time — enables DSPy version-attributed analytics */
      promptVersions: i.json(),
      // Timestamps
      createdAt: i.number(),
      updatedAt: i.number(),
      approvedAt: i.any(),
      archivedAt: i.any(),
      sentAt: i.any(),
      respondedAt: i.any(),
    }),
    pipelineRuns: i.entity({
      pipelineRunId: i.string(),
      leadInput: i.json(),
      currentPhase: i.string(),
      finalStatus: i.string(),
      phases: i.json(),
      traces: i.json(),
      promptVersions: i.json(),
      modelMetadata: i.json(),
      error: i.any(),
      jobId: i.any(),
      startedAt: i.number(),
      completedAt: i.any(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),
  },
});
