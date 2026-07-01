// "Changes since last review" — the missing piece of the academic review flow.
//
// Section status, advisor notes, and the advisor Markdown report already exist.
// What was missing is a way for the author (and their advisor) to see *what
// changed* since the document was last sent for review. We capture a lightweight
// checkpoint — per section: word count, block count, and editorial status — when
// the author marks a review, then diff the current model against it.
//
// The checkpoint lives in localStorage keyed by project path. This is a
// deliberately frontend-only, local-first design: it never touches the
// transactional save pipeline, so it cannot destabilize project files, and it
// matches the single-author-per-machine reality of the app today.

import type { ProjectModel, ProjectSection, SectionStatus } from "../types";
import { countWords } from "../lib/projectReadiness";

export interface SectionSnapshot {
  words: number;
  blocks: number;
  status: SectionStatus;
}

export interface ReviewCheckpoint {
  /** ISO-8601 timestamp of when the checkpoint was captured. */
  at: string;
  /** Per enabled body section, keyed by section id. */
  sections: Record<string, SectionSnapshot>;
}

export type SectionChangeKind = "added" | "removed" | "grew" | "shrank" | "status" | "unchanged";

export interface SectionChange {
  id: string;
  title: string;
  kind: SectionChangeKind;
  wordDelta: number;
  fromStatus?: SectionStatus;
  toStatus?: SectionStatus;
}

export interface ReviewDiff {
  since: string | null;
  changes: SectionChange[];
  /** True when there is a checkpoint and at least one meaningful change. */
  hasChanges: boolean;
}

const KEY_PREFIX = "tx-review-checkpoint:";

function keyFor(projectPath: string): string {
  return `${KEY_PREFIX}${projectPath}`;
}

function bodySections(model: ProjectModel): ProjectSection[] {
  return model.sections.filter((s) => s.enabled && s.placement === "body");
}

function snapshotSection(section: ProjectSection): SectionSnapshot {
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  return {
    words: countWords(blocks),
    blocks: blocks.length,
    status: section.status ?? "draft",
  };
}

/** Builds (but does not persist) a checkpoint for the current model. */
export function buildCheckpoint(model: ProjectModel): ReviewCheckpoint {
  const sections: Record<string, SectionSnapshot> = {};
  for (const section of bodySections(model)) {
    sections[section.id] = snapshotSection(section);
  }
  return { at: new Date().toISOString(), sections };
}

export function loadCheckpoint(projectPath: string): ReviewCheckpoint | null {
  try {
    const raw = localStorage.getItem(keyFor(projectPath));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.sections) return parsed as ReviewCheckpoint;
    return null;
  } catch {
    return null;
  }
}

export function saveCheckpoint(projectPath: string, model: ProjectModel): ReviewCheckpoint {
  const checkpoint = buildCheckpoint(model);
  try {
    localStorage.setItem(keyFor(projectPath), JSON.stringify(checkpoint));
  } catch {
    // Non-fatal: a full quota just means no "changes since" tracking.
  }
  return checkpoint;
}

export function clearCheckpoint(projectPath: string): void {
  try {
    localStorage.removeItem(keyFor(projectPath));
  } catch {
    /* ignore */
  }
}

/**
 * Diffs the current model against a checkpoint. When `checkpoint` is null the
 * diff has no baseline (`since` is null and `hasChanges` false) — the UI should
 * prompt the author to mark their first review.
 */
export function diffAgainstCheckpoint(
  model: ProjectModel,
  checkpoint: ReviewCheckpoint | null,
): ReviewDiff {
  if (!checkpoint) return { since: null, changes: [], hasChanges: false };

  const current = bodySections(model);
  const currentIds = new Set(current.map((s) => s.id));
  const changes: SectionChange[] = [];

  for (const section of current) {
    const now = snapshotSection(section);
    const before = checkpoint.sections[section.id];
    const title = section.title ?? section.element_id;
    if (!before) {
      changes.push({ id: section.id, title, kind: "added", wordDelta: now.words });
      continue;
    }
    const wordDelta = now.words - before.words;
    const statusChanged = now.status !== before.status;
    let kind: SectionChangeKind = "unchanged";
    if (wordDelta > 0) kind = "grew";
    else if (wordDelta < 0) kind = "shrank";
    else if (statusChanged) kind = "status";

    if (kind !== "unchanged") {
      changes.push({
        id: section.id,
        title,
        kind,
        wordDelta,
        fromStatus: statusChanged ? before.status : undefined,
        toStatus: statusChanged ? now.status : undefined,
      });
    } else if (statusChanged) {
      // Word count identical but status moved — still worth reporting.
      changes.push({ id: section.id, title, kind: "status", wordDelta: 0, fromStatus: before.status, toStatus: now.status });
    }
  }

  // Sections present at checkpoint but gone now (disabled or deleted).
  for (const id of Object.keys(checkpoint.sections)) {
    if (!currentIds.has(id)) {
      changes.push({ id, title: id, kind: "removed", wordDelta: -checkpoint.sections[id].words });
    }
  }

  return { since: checkpoint.at, changes, hasChanges: changes.length > 0 };
}
