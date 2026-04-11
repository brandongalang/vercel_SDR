import { Calendar, MousePointerClick, Code2, Globe, Zap, Users, Megaphone } from "lucide-react";
import React from "react";
import type { Play, PlayType } from "@/lib/types";

export const PLAY_CONFIG: Record<PlayType, { label: string; icon: React.ReactNode; color: string }> = {
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

export const getPlayConfig = (play: Play | string) => {
  if (typeof play === "string") {
    // Legacy string fallback for seeded data
    return {
      label: play,
      icon: <Globe size={12} className="opacity-70" />,
      color: "text-zinc-600 bg-zinc-100 border-zinc-200",
    };
  }
  return PLAY_CONFIG[play.type] ?? {
    label: play.label,
    icon: <Globe size={12} className="opacity-70" />,
    color: "text-zinc-600 bg-zinc-100 border-zinc-200",
  };
};
