type ResearchStageResult = Awaited<
  ReturnType<(typeof import("@/lib/pipeline/research-agent"))["runResearchAgent"]>
>;

export interface PipelineResearchTraceCollection {
  orchestratorSteps: ResearchStageResult["steps"];
  threadTraces: ResearchStageResult["threadTraces"];
}

export interface PipelineTraces {
  research?: PipelineResearchTraceCollection;
}
