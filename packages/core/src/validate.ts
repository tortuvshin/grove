import { access } from "node:fs/promises";
import {
  decisionsFileSchema,
  healthFileSchema,
  itemsFileSchema,
  unwrapDecisions,
  unwrapHealth,
  unwrapItems,
  type CuratedConfig,
} from "./schema.js";
import { readYamlFile } from "./io.js";

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function validateProject(config: CuratedConfig): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  if (!(await exists(config.paths.items))) {
    issues.push({ code: "missing_items", message: `${config.paths.items} does not exist` });
    return { ok: false, issues };
  }

  const items = unwrapItems(itemsFileSchema.parse(await readYamlFile(config.paths.items)));
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      issues.push({ code: "duplicate_id", message: `Duplicate item id: ${item.id}` });
    }
    ids.add(item.id);
    if (!item.description.trim()) {
      issues.push({ code: "missing_description", message: `${item.id} is missing a description` });
    }
    if (!item.taxonomy.category.trim()) {
      issues.push({ code: "missing_category", message: `${item.id} is missing a category` });
    }
    if (!item.links.github && !item.links.website) {
      issues.push({ code: "missing_link", message: `${item.id} has neither github nor website link` });
    }
  }

  if (await exists(config.paths.health)) {
    const health = unwrapHealth(healthFileSchema.parse(await readYamlFile(config.paths.health)));
    const healthIds = new Set(health.map((entry) => entry.id));
    for (const item of items) {
      if (item.links.github && !healthIds.has(item.id)) {
        issues.push({ code: "missing_health", message: `${item.id} has a GitHub link but no health entry` });
      }
    }
  }

  if (await exists(config.paths.decisions)) {
    const decisions = unwrapDecisions(decisionsFileSchema.parse(await readYamlFile(config.paths.decisions)));
    for (const decision of decisions) {
      if (!ids.has(decision.id)) {
        issues.push({ code: "unknown_decision_item", message: `Decision references unknown item: ${decision.id}` });
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
