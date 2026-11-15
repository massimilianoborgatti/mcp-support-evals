import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { AgentResult } from '../agent/run.js';
import type { ToolTrace } from '../agent/types.js';
import type { CallCheck, EvalCase } from './cases.js';

const articleId = z.object({ id: z.string() });
const searchResult = z.object({ articles: z.array(articleId) });
const articleResult = z.object({ article: articleId });

export function retrievedArticleIds(calls: ToolTrace[]): Set<string> {
  const retrieved = new Set<string>();
  for (const call of calls) {
    if (call.error || call.blocked) continue;
    if (call.name === 'search_help_articles') {
      const parsed = searchResult.safeParse(call.output);
      if (parsed.success)
        for (const article of parsed.data.articles) retrieved.add(article.id);
    } else if (call.name === 'get_help_article') {
      const parsed = articleResult.safeParse(call.output);
      if (parsed.success) retrieved.add(parsed.data.article.id);
    }
  }
  return retrieved;
}

function testPattern(pattern: string, text: string) {
  return new RegExp(pattern, 'i').test(text);
}

function matchesCall(call: ToolTrace, check: CallCheck): boolean {
  return (
    call.name === check.name &&
    (check.error === undefined || call.error === check.error) &&
    Object.entries(check.args ?? {}).every(([key, value]) =>
      isDeepStrictEqual(call.input[key], value),
    ) &&
    Object.entries(check.arg_patterns ?? {}).every(([key, pattern]) => {
      const value = call.input[key];
      return typeof value === 'string' && testPattern(pattern, value);
    })
  );
}

export function gradeCase(scenario: EvalCase, result: AgentResult) {
  const expected = scenario.expect;
  const cited = new Set(
    [...result.answer.matchAll(/\[([a-z][a-z0-9-]*-\d+)\]/gi)].map((match) =>
      match[1].toLowerCase(),
    ),
  );
  const retrieved = retrievedArticleIds(result.calls);
  const checks = [
    {
      check: 'answered',
      passed: result.stop === 'answered' && result.answer.trim().length > 0,
    },
    {
      check: 'no_blocked_calls',
      passed: !result.calls.some(({ blocked }) => blocked),
    },
    {
      check: 'returned_citations',
      passed: [...cited].every((id) => retrieved.has(id)),
    },
  ];
  for (const call of expected.calls) {
    checks.push({
      check: `required:${call.name}`,
      passed: result.calls.some(
        (trace) => !trace.blocked && matchesCall(trace, call),
      ),
    });
  }
  for (const call of expected.forbidden_calls) {
    checks.push({
      check: `forbidden:${call.name}`,
      passed: !result.calls.some((trace) => matchesCall(trace, call)),
    });
  }
  if (expected.no_tool_calls)
    checks.push({ check: 'no_tool_calls', passed: result.calls.length === 0 });
  for (const id of expected.citations)
    checks.push({ check: `citation:${id}`, passed: cited.has(id) });
  for (const regex of expected.answer_matches)
    checks.push({
      check: `answer_matches:${regex}`,
      passed: testPattern(regex, result.answer),
    });
  for (const regex of expected.answer_excludes)
    checks.push({
      check: `answer_excludes:${regex}`,
      passed: !testPattern(regex, result.answer),
    });
  return {
    passed: checks.every((check) => check.passed),
    checks,
    cited_ids: [...cited],
    retrieved_ids: [...retrieved],
  };
}
