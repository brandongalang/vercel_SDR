import { AngleType } from './types';

/** Muted chips: single accent per angle type; avoid competing with queue amber (governance). */
export const ANGLE_CONFIG: Record<
  AngleType,
  { label: string; color: string; dot: string; borderColor: string; description: string }
> = {
  tech_migration: {
    label: 'Tech Migration',
    color: 'bg-white text-zinc-800 border-zinc-200',
    dot: 'bg-teal-500',
    borderColor: 'border-l-teal-500',
    description: 'Repo or stack change we can cite — migrations, framework shifts, infra bets.',
  },
  trial_activation: {
    label: 'Trial Activation',
    color: 'bg-white text-zinc-800 border-zinc-200',
    dot: 'bg-slate-500',
    borderColor: 'border-l-slate-500',
    description: 'Product usage and trial timing — activation, seats, projects, evaluation phase.',
  },
  event_signal: {
    label: 'Event Signal',
    color: 'bg-white text-zinc-800 border-zinc-200',
    dot: 'bg-amber-500',
    borderColor: 'border-l-amber-500',
    description: 'Conferences, webinars, registrations — timely reason to reach out.',
  },
  social_post: {
    label: 'Social Signal',
    color: 'bg-white text-zinc-800 border-zinc-200',
    dot: 'bg-teal-400',
    borderColor: 'border-l-teal-400',
    description: 'Public posts or threads that show intent, priorities, or narrative hooks.',
  },
  web_intent: {
    label: 'Web Intent',
    color: 'bg-white text-zinc-800 border-zinc-200',
    dot: 'bg-amber-500',
    borderColor: 'border-l-amber-500',
    description: 'Site behavior — docs, pricing, repeat visits from identifiable context.',
  },
  hiring_signal: {
    label: 'Hiring Signal',
    color: 'bg-white text-zinc-800 border-zinc-200',
    dot: 'bg-slate-400',
    borderColor: 'border-l-slate-400',
    description: 'Open roles or team growth that imply tooling or platform needs.',
  },
  generic: {
    label: 'Generic',
    color: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    dot: 'bg-zinc-400',
    borderColor: 'border-l-zinc-400',
    description: 'Thin or inferred hook — better than a template, but weak differentiation.',
  },
};
