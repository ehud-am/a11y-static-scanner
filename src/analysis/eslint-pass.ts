import { ESLint } from 'eslint';
import { v4 as uuidv4 } from 'uuid';
import type { Issue } from '../types.js';
import { getRuleMapping } from './wcag-map.js';

const ESLINT_OVERRIDE_CONFIG: ESLint.ConfigData = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['jsx-a11y'],
  rules: {
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/anchor-has-content': 'error',
    'jsx-a11y/anchor-is-valid': 'error',
    'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-role': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',
    'jsx-a11y/autocomplete-valid': 'error',
    'jsx-a11y/click-events-have-key-events': 'error',
    'jsx-a11y/heading-has-content': 'error',
    'jsx-a11y/html-has-lang': 'warn',
    'jsx-a11y/iframe-has-title': 'error',
    'jsx-a11y/img-redundant-alt': 'error',
    'jsx-a11y/interactive-supports-focus': 'error',
    'jsx-a11y/label-has-associated-control': 'error',
    'jsx-a11y/media-has-caption': 'error',
    'jsx-a11y/mouse-events-have-key-events': 'error',
    'jsx-a11y/no-access-key': 'error',
    'jsx-a11y/no-autofocus': 'warn',
    'jsx-a11y/no-distracting-elements': 'error',
    'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
    'jsx-a11y/no-noninteractive-element-interactions': 'error',
    'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
    'jsx-a11y/no-noninteractive-tabindex': 'error',
    'jsx-a11y/no-redundant-roles': 'warn',
    'jsx-a11y/no-static-element-interactions': 'error',
    'jsx-a11y/prefer-tag-over-role': 'warn',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'error',
    'jsx-a11y/scope': 'error',
    'jsx-a11y/tabindex-no-positive': 'error',
  },
};

function extractSnippet(content: string, line: number): string {
  const lines = content.split('\n');
  const start = Math.max(0, line - 2);
  const end = Math.min(lines.length, line + 1);
  return lines.slice(start, end).join('\n');
}

export async function runEslintPass(
  filePath: string,
  fileContent: string,
  repoRoot: string,
): Promise<Issue[]> {
  const eslint = new ESLint({
    useEslintrc: false,
    overrideConfig: ESLINT_OVERRIDE_CONFIG,
  });

  let results: ESLint.LintResult[];
  try {
    results = await eslint.lintText(fileContent, { filePath });
  } catch {
    // Parse failure — return empty; AST pass may still catch something
    return [];
  }

  const issues: Issue[] = [];
  const relPath = filePath.startsWith(repoRoot + '/')
    ? filePath.slice(repoRoot.length + 1)
    : filePath;

  for (const result of results) {
    for (const msg of result.messages) {
      if (!msg.ruleId) continue;
      const mapping = getRuleMapping(msg.ruleId);
      if (!mapping) continue;

      issues.push({
        id: uuidv4(),
        file: relPath,
        line: msg.line ?? 1,
        column: msg.column ?? 1,
        rule_id: msg.ruleId,
        wcag_criterion: mapping.criterion,
        wcag_level: mapping.level,
        severity: mapping.severity,
        message: msg.message,
        code_snippet: extractSnippet(fileContent, msg.line ?? 1),
        wcag_title: mapping.title,
        wcag_url: mapping.url,
      });
    }
  }

  return issues;
}
