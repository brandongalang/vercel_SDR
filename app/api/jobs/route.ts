import { createJobsHandlers } from "@/lib/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = createJobsHandlers();
export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
