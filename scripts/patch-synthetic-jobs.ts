import fs from "fs";
import path from "path";
import { determineGovernance } from "../lib/pipeline/governance";

type GovernanceInput = Parameters<typeof determineGovernance>[0];

type SyntheticJob = {
  company: string;
  companySize?: string;
  confidence: { tier: GovernanceInput["confidenceTier"] };
  play: { leadSource: GovernanceInput["leadSource"] };
  governance?: string;
};

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

const files = ["synthetic-jobs-all.json", "synthetic-jobs-v1.json", "synthetic-jobs-v2.json"];

for (const file of files) {
  const p = path.resolve(process.cwd(), "data", file);
  if (!fs.existsSync(p)) continue;
  
  const jobs = JSON.parse(fs.readFileSync(p, "utf8")) as SyntheticJob[];
  const updated = jobs.map((job) => {
    job.companySize = getHeuristicSize(job.company);
    const gov = determineGovernance({
      confidenceTier: job.confidence.tier,
      leadSource: job.play.leadSource,
      companySize: job.companySize,
    });
    job.governance = gov.governance;
    return job;
  });
  
  fs.writeFileSync(p, JSON.stringify(updated, null, 2));
  console.log(`Successfully patched ${file}`);
}
