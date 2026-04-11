import SDRWorkspace from "@/components/SDRWorkspace";
import { MOCK_ANALYTICS_MAP } from "@/lib/analytics-mock";

export default function Home() {
  return <SDRWorkspace analyticsMap={MOCK_ANALYTICS_MAP} />;
}

