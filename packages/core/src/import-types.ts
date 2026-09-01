export interface ImportedRecord {
  slug: string;
  name: string;
  description: string;
  category: string;
  links: { github?: string; website?: string; source?: string };
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  categories: string[];
  duplicateSlugs: number;
  tocSkipped: number;
  anchorLinksSkipped: number;
}

export interface ImportResult {
  records: ImportedRecord[];
  report: ImportSummary;
}
