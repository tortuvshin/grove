// SPDX-License-Identifier: MIT
/**
 * Stack inference from GitHub repository metadata.
 *
 * Used by the submission form to suggest a primary stack based on
 * the language and topics of a repo, before the curator confirms.
 * Pre-v1 this lived inline inside `SubmissionClient.astro` lines
 * 83–91 — domain logic embedded in UI, in violation of §11.
 *
 * The rules are deliberately conservative: they prefer a curated
 * Grove stack id (`flutter`, `react-native`, `ios`, `android`) over
 * the raw language so the suggestion aligns with what the rest of
 * Grove's taxonomy treats as a stack. Unknown languages fall
 * through to the raw lowercased language name (e.g. `"go"`,
 * `"rust"`) so the curator at least sees the project's actual
 * primary language.
 */

export interface InferStackInput {
  language?: string | null;
  topics?: readonly string[] | null;
}

/**
 * Returns the suggested stack id (lowercased, trimmed) for the
 * repository, or `null` if the input carries no language or
 * topic signal at all.
 */
export function inferStackFromTopics(input: InferStackInput): string | null {
  const language = String(input.language || '').toLowerCase();
  const topics = (input.topics || []).map((topic) => String(topic).toLowerCase());
  if (topics.includes('flutter') || language === 'dart') return 'flutter';
  if (topics.includes('react-native')) return 'react-native';
  if (language === 'swift' || language === 'objective-c') return 'ios';
  if (language === 'kotlin' || language === 'java') return 'android';
  if (language) return language;
  return null;
}
