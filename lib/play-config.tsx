import { Calendar, MousePointerClick, Code2, Globe, Zap, Users, Megaphone } from "lucide-react";
import type { ReactNode } from "react";
import type { Play, PlayType } from "@/lib/types";

const PLAY_CONFIG: Record<PlayType, { label: string; icon: ReactNode; color: string }> = {
  event: {
    label: "Event",
    icon: <Calendar size={12} className="opacity-70" />,
    color: "text-zinc-600 bg-zinc-50 border-zinc-200",
  },
  plg_signup: {
    label: "PLG",
    icon: <MousePointerClick size={12} className="opacity-70" />,
    color: "text-zinc-600 bg-zinc-50 border-zinc-200",
  },
  tech_migration: {
    label: "Tech Stack",
    icon: <Code2 size={12} className="opacity-70" />,
    color: "text-zinc-600 bg-zinc-50 border-zinc-200",
  },
  web_intent: {
    label: "Web Activity",
    icon: <Globe size={12} className="opacity-70" />,
    color: "text-zinc-600 bg-zinc-50 border-zinc-200",
  },
  hiring_signal: {
    label: "Hiring",
    icon: <Zap size={12} className="opacity-70" />,
    color: "text-zinc-600 bg-zinc-50 border-zinc-200",
  },
  social_post: {
    label: "Social",
    icon: <Megaphone size={12} className="opacity-70" />,
    color: "text-zinc-600 bg-zinc-50 border-zinc-200",
  },
  outbound_prospecting: {
    label: "Outbound",
    icon: <Users size={12} className="opacity-70" />,
    color: "text-zinc-600 bg-zinc-50 border-zinc-200",
  },
};

export function getPlayConfig(play: Play) {
  return PLAY_CONFIG[play.type];
}
