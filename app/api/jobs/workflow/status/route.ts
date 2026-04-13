import { getRun } from "workflow/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");
  
  if (!runId) {
    return Response.json({ error: "Missing runId" }, { status: 400 });
  }

  try {
    const run = getRun(runId);
    if (!run) {
      return Response.json({ error: "Run not found" }, { status: 404 });
    }

    const status = await run.status;

    if (status === "completed") {
      const result = await run.returnValue;
      return Response.json({ status, result });
    }

    return Response.json({ status });
  } catch (err) {
    return Response.json({ error: "Failed to fetch run status" }, { status: 500 });
  }
}
