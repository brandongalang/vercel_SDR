import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import type { ScoredSignal, DiscardedSignal, ConfidenceTier, GovernanceRule, JobStatus } from '../types';

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // -- Lead Input
  leadName: text('lead_name').notNull(),
  leadTitle: text('lead_title').notNull(),
  company: text('company').notNull(),
  play: text('play').notNull(),
  crmSignals: jsonb('crm_signals').$type<string[]>(),

  // -- Pipeline State
  pipelineStatus: text('pipeline_status').notNull().default('pending'),
  pipelineStage: text('pipeline_stage'),
  
  // -- S1 Output
  rawHits: jsonb('raw_hits'), // RawExaHit[]

  // -- S2 Output
  signals: jsonb('signals').$type<ScoredSignal[]>(),
  extractionNotes: text('extraction_notes'),

  // -- S3 Output
  angle: text('angle'),
  confidenceTier: text('confidence_tier').$type<ConfidenceTier>(),
  confidenceSummary: text('confidence_summary'),
  confidenceReasons: jsonb('confidence_reasons').$type<string[]>(),
  usedSignalIds: jsonb('used_signal_ids').$type<string[]>(),
  discardedSignals: jsonb('discarded_signals').$type<DiscardedSignal[]>(),

  // -- S4 Output
  draftSubject: text('draft_subject'),
  draftBody: text('draft_body'),
  highlightedSpan: text('highlighted_span'),

  // -- S5 Output
  governance: text('governance').$type<GovernanceRule>(),
  verifyIssues: jsonb('verify_issues').$type<string[]>(),

  // -- SDR State
  sdrStatus: text('sdr_status').$type<JobStatus>().notNull().default('pending_review'),
  sdrEditedSubject: text('sdr_edited_subject'),
  sdrEditedBody: text('sdr_edited_body'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const logEvents = pgTable('log_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobs.id).notNull(),

  action: text('action').notNull(), // 'approved' | 'reviewed' | 'edited' | 'regenerated'
  preset: text('preset'), // for regenerated
  editorNote: text('editor_note'),

  // Snapshot for DSPy implicit metric mapping
  snapshotConfidenceTier: text('snapshot_confidence_tier'),
  snapshotPlay: text('snapshot_play'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
