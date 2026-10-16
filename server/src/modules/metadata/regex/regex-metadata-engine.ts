import {
  parseSeriesIndex,
  REGEX_METADATA_GROUPS,
  type RegexMetadataConfig,
  type RegexMetadataDiagnostic,
  type RegexMetadataFields,
  type RegexMetadataPreview,
} from '@bookorbit/types';
import { isPublishedDateKey, parsePublishedYear } from '../../../common/utils/published-date.utils';

export interface RegexMetadataTask {
  config: RegexMetadataConfig;
  inputPath?: string;
}

interface CompiledRules {
  key: string;
  compiled: RegExp[];
  diagnostics: RegexMetadataDiagnostic[];
}

// A scan sends the same rules for every book, so the worker keeps the last compiled set.
let lastCompiled: CompiledRules | undefined;

function compileRules(config: RegexMetadataConfig): CompiledRules {
  const key = JSON.stringify(config.rules.map(({ pattern, flags }) => [pattern, flags]));
  if (lastCompiled?.key === key) return lastCompiled;
  const compiled: RegExp[] = [];
  const diagnostics: RegexMetadataDiagnostic[] = [];
  for (const [ruleIndex, rule] of config.rules.entries()) {
    try {
      const pattern = rule.pattern.normalize('NFC');
      const regex = new RegExp(pattern, rule.flags);
      // The empty first alternative exposes group names without executing the user's pattern.
      const groups = Object.keys(new RegExp(`|(?:${pattern})`, rule.flags).exec('')?.groups ?? {});
      if (!groups.some((group) => (REGEX_METADATA_GROUPS as readonly string[]).includes(group))) {
        diagnostics.push({ code: 'missing_group', ruleIndex });
      }
      if (groups.includes('author') && groups.includes('authors')) {
        diagnostics.push({ code: 'conflicting_authors', ruleIndex });
      }
      compiled.push(regex);
    } catch {
      diagnostics.push({ code: 'invalid_pattern', ruleIndex });
    }
  }
  lastCompiled = { key, compiled, diagnostics };
  return lastCompiled;
}

export function evaluateRegexMetadata({ config, inputPath }: RegexMetadataTask): RegexMetadataPreview {
  const { compiled, diagnostics } = compileRules(config);
  const result: RegexMetadataPreview = {
    inputPath: inputPath ?? '',
    matched: false,
    ruleIndex: null,
    groups: {},
    metadata: {},
    diagnostics: [...diagnostics],
  };
  if (result.diagnostics.length || inputPath === undefined) return result;

  for (const [ruleIndex, regex] of compiled.entries()) {
    const match = regex.exec(inputPath);
    if (!match?.groups) continue;
    const groups = Object.fromEntries(Object.entries(match.groups).filter((entry): entry is [string, string] => entry[1] !== undefined));
    const metadata = normalizeGroups(groups, ruleIndex, result.diagnostics);
    if (!Object.keys(metadata).length) continue;
    return { ...result, matched: true, ruleIndex, groups, metadata };
  }
  return result;
}

function normalizeGroups(groups: Record<string, string>, ruleIndex: number, diagnostics: RegexMetadataDiagnostic[]): RegexMetadataFields {
  const metadata: RegexMetadataFields = {};
  for (const [group, field, limit] of [
    ['title', 'title', 1000],
    ['series', 'seriesName', 200],
  ] as const) {
    const value = groups[group]?.trim();
    if (!value) continue;
    if (value.length > limit) diagnostics.push({ code: 'invalid_value', ruleIndex, field: group });
    else metadata[field] = value;
  }
  const seriesIndex = groups.seriesIndex?.trim();
  if (seriesIndex) {
    // The column only accepts plain decimals; a decimal comma is the one spelling worth repairing.
    const parsed = parseSeriesIndex(seriesIndex.replace(/^(\d+),(\d+)$/, '$1.$2'));
    if (parsed === null) diagnostics.push({ code: 'invalid_value', ruleIndex, field: 'seriesIndex' });
    else metadata.seriesIndex = parsed;
  }
  const author = groups.author?.trim();
  const authors = author
    ? [author]
    : groups.authors
        ?.split(';')
        .map((value) => value.trim())
        .filter(Boolean);
  if (authors?.length) {
    if (authors.some((value) => value.length > 200)) diagnostics.push({ code: 'invalid_value', ruleIndex, field: 'authors' });
    else metadata.authors = [...new Set(authors)];
  }
  const year = groups.publishedYear?.trim();
  if (year) {
    const parsed = /^\d{4}$/.test(year) ? parsePublishedYear(year) : undefined;
    if (parsed === undefined) diagnostics.push({ code: 'invalid_value', ruleIndex, field: 'publishedYear' });
    else metadata.publishedYear = parsed;
  }
  const date = groups.publishedDate?.trim();
  if (date) {
    if (!isPublishedDateKey(date)) diagnostics.push({ code: 'invalid_value', ruleIndex, field: 'publishedDate' });
    else {
      metadata.publishedDate = date;
      metadata.publishedYear = Number(date.slice(0, 4));
    }
  }
  return metadata;
}
