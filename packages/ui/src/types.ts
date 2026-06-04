import type { CuratedItem, Decision, HealthEntry, HealthStatus, Score } from "@grove-dev/core";
import type { SORT_OPTIONS } from "./constants.js";

export interface DirectoryStats {
  total: number;
  active: number;
  mature: number;
  needsReview: number;
  archived: number;
  stale: number;
  inactive: number;
  unknown: number;
}

export interface DirectoryRecord {
  item: CuratedItem;
  health?: HealthEntry;
  decision?: Decision;
}

export interface DirectoryFilters {
  q?: string;
  category?: string;
  tag?: string;
  language?: string;
  license?: string;
  health?: HealthStatus | "all";
  label?: string;
  lens?: string;
  sort?: DirectorySort;
  density?: "comfortable" | "compact";
  page?: number;
  maintained?: boolean;
  hideArchived?: boolean;
  hasRecentRelease?: boolean;
}

export type DirectorySort = (typeof SORT_OPTIONS)[number]["value"];

export interface FilterChip {
  key: keyof DirectoryFilters;
  label: string;
  value: string;
}

export type ScoreKey = keyof Score;
