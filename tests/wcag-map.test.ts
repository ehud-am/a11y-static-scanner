import { describe, it, expect } from 'vitest';
import {
  WCAG_CRITERIA,
  RULE_TO_WCAG,
  getCriterion,
  getRuleMapping,
  CHECKABLE_CRITERIA,
} from '../src/analysis/wcag-map.js';

describe('WCAG_CRITERIA database', () => {
  it('contains all WCAG 2.2 new criteria', () => {
    const newIn22 = ['2.4.11', '2.4.12', '2.5.7', '2.5.8', '3.2.6', '3.3.7', '3.3.8', '3.3.9'];
    for (const id of newIn22) {
      expect(WCAG_CRITERIA[id], `Missing criterion ${id}`).toBeDefined();
    }
  });

  it('every criterion has required fields', () => {
    for (const [id, criterion] of Object.entries(WCAG_CRITERIA)) {
      expect(criterion.id).toBe(id);
      expect(criterion.title).toBeTruthy();
      expect(['A', 'AA', 'AAA']).toContain(criterion.level);
      expect(criterion.description).toBeTruthy();
      expect(criterion.url).toMatch(/^https:\/\/www\.w3\.org/);
    }
  });

  it('getCriterion returns correct entry', () => {
    const c = getCriterion('1.1.1');
    expect(c).toBeDefined();
    expect(c!.title).toBe('Non-text Content');
    expect(c!.level).toBe('A');
  });

  it('getCriterion returns undefined for unknown IDs', () => {
    expect(getCriterion('9.9.9')).toBeUndefined();
  });
});

describe('RULE_TO_WCAG mapping', () => {
  it('every mapping has required fields', () => {
    for (const [ruleId, mapping] of Object.entries(RULE_TO_WCAG)) {
      expect(mapping.criterion, `${ruleId} missing criterion`).toBeTruthy();
      expect(['A', 'AA', 'AAA'], `${ruleId} bad level`).toContain(mapping.level);
      expect(mapping.title, `${ruleId} missing title`).toBeTruthy();
      expect(['critical', 'serious', 'moderate', 'minor'], `${ruleId} bad severity`).toContain(
        mapping.severity,
      );
      expect(mapping.url, `${ruleId} missing url`).toMatch(/^https:\/\//);
    }
  });

  it('every mapped criterion exists in WCAG_CRITERIA', () => {
    for (const [ruleId, mapping] of Object.entries(RULE_TO_WCAG)) {
      expect(
        WCAG_CRITERIA[mapping.criterion],
        `Rule ${ruleId} references unknown criterion ${mapping.criterion}`,
      ).toBeDefined();
    }
  });

  it('getRuleMapping returns correct data for known rules', () => {
    const m = getRuleMapping('jsx-a11y/alt-text');
    expect(m).toBeDefined();
    expect(m!.criterion).toBe('1.1.1');
    expect(m!.level).toBe('A');
    expect(m!.severity).toBe('critical');
  });

  it('getRuleMapping returns undefined for unknown rules', () => {
    expect(getRuleMapping('jsx-a11y/nonexistent-rule')).toBeUndefined();
  });

  it('contains all major jsx-a11y rules', () => {
    const required = [
      'jsx-a11y/alt-text',
      'jsx-a11y/anchor-has-content',
      'jsx-a11y/aria-role',
      'jsx-a11y/label-has-associated-control',
      'jsx-a11y/click-events-have-key-events',
      'jsx-a11y/tabindex-no-positive',
    ];
    for (const rule of required) {
      expect(RULE_TO_WCAG[rule], `Missing rule ${rule}`).toBeDefined();
    }
  });

  it('contains all custom check rules', () => {
    const customRules = [
      'custom/svg-missing-accessible-name',
      'custom/table-missing-caption',
      'custom/onclick-without-keyboard',
      'custom/focus-outline-removed',
      'custom/role-button-no-keyboard',
    ];
    for (const rule of customRules) {
      expect(RULE_TO_WCAG[rule], `Missing custom rule ${rule}`).toBeDefined();
    }
  });
});

describe('CHECKABLE_CRITERIA', () => {
  it('is a non-empty Set of criterion IDs', () => {
    expect(CHECKABLE_CRITERIA.size).toBeGreaterThan(0);
  });

  it('only contains IDs that exist in WCAG_CRITERIA', () => {
    for (const id of CHECKABLE_CRITERIA) {
      expect(WCAG_CRITERIA[id], `Checkable criterion ${id} not in database`).toBeDefined();
    }
  });
});
