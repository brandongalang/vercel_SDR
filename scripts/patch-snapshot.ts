import fs from "fs";
import path from "path";
import snapshotJobs from "../data/demo-snapshot.json";
import { determineGovernance } from "../lib/pipeline/governance";

type SnapshotJob = (typeof snapshotJobs)[number];
type GovernanceInput = Parameters<typeof determineGovernance>[0];

function getHeuristicSize(company: string): string {
  const match = company.toLowerCase();
  if (match.includes("health") || match.includes("bank") || match.includes("corp") || match.includes("inc") || match.includes("global") || match.includes("systems") || match.includes("group")) {
    return "enterprise";
  }
  if (match.includes("startup") || match.includes("labs") || match.includes("app") || match.includes("studio") || match.includes("hq")) {
    return "startup";
  }
  if (company.length < 8) {
    return "smb";
  }
  return "mid_market";
}

const updatedJobs = snapshotJobs.map((job: SnapshotJob) => {
  job.companySize = getHeuristicSize(job.company);
  
  const gov = determineGovernance({
    confidenceTier: job.confidence.tier as GovernanceInput["confidenceTier"],
    leadSource: job.play.leadSource as GovernanceInput["leadSource"],
    companySize: job.companySize,
  });

  // ONLY modify pending_review so we don't break the already-sent / skipped demo metrics
  if (job.status === "pending_review") {
     job.governance = gov.governance;
     job.status = gov.status;
  } else {
     job.governance = gov.governance; // update governance label anyway for consistency
  }
  
  return job;
});

const p = path.resolve(process.cwd(), "data/demo-snapshot.json");
fs.writeFileSync(p, JSON.stringify(updatedJobs, null, 2));

console.log("Successfully patched " + updatedJobs.length + " jobs with company sizes and re-evaluated governance.");
