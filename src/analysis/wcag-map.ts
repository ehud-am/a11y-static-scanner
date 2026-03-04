import type { WcagCriterion, WcagLevel, WcagRuleMapping } from '../types.js';

// ─── WCAG 2.2 Criterion Database ─────────────────────────────────────────────

export const WCAG_CRITERIA: Record<string, WcagCriterion> = {
  '1.1.1': {
    id: '1.1.1', level: 'A', title: 'Non-text Content',
    description: 'All non-text content that is presented to the user has a text alternative that serves the equivalent purpose.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
  },
  '1.2.1': {
    id: '1.2.1', level: 'A', title: 'Audio-only and Video-only (Prerecorded)',
    description: 'For prerecorded audio-only and video-only media, alternatives are provided.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded.html',
  },
  '1.2.2': {
    id: '1.2.2', level: 'A', title: 'Captions (Prerecorded)',
    description: 'Captions are provided for all prerecorded audio content in synchronized media.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html',
  },
  '1.3.1': {
    id: '1.3.1', level: 'A', title: 'Info and Relationships',
    description: 'Information, structure, and relationships conveyed through presentation can be programmatically determined.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
  },
  '1.3.5': {
    id: '1.3.5', level: 'AA', title: 'Identify Input Purpose',
    description: 'The purpose of each input field collecting information about the user can be programmatically determined.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html',
  },
  '1.4.1': {
    id: '1.4.1', level: 'A', title: 'Use of Color',
    description: 'Color is not used as the only visual means of conveying information.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html',
  },
  '2.1.1': {
    id: '2.1.1', level: 'A', title: 'Keyboard',
    description: 'All functionality of the content is operable through a keyboard interface.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
  },
  '2.1.4': {
    id: '2.1.4', level: 'A', title: 'Character Key Shortcuts',
    description: 'If a keyboard shortcut is implemented using only a single letter, mechanisms to remap or disable it are provided.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html',
  },
  '2.2.2': {
    id: '2.2.2', level: 'A', title: 'Pause, Stop, Hide',
    description: 'For moving, blinking, scrolling, or auto-updating information, mechanisms exist to pause, stop, or hide it.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html',
  },
  '2.4.1': {
    id: '2.4.1', level: 'A', title: 'Bypass Blocks',
    description: 'A mechanism is available to bypass blocks of content that are repeated on multiple pages.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html',
  },
  '2.4.3': {
    id: '2.4.3', level: 'A', title: 'Focus Order',
    description: 'If a page can be navigated sequentially and the navigation sequences affect meaning, focusable components receive focus in an order that preserves meaning.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html',
  },
  '2.4.4': {
    id: '2.4.4', level: 'A', title: 'Link Purpose (In Context)',
    description: 'The purpose of each link can be determined from the link text alone, or from the link text together with its programmatically determined context.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html',
  },
  '2.4.6': {
    id: '2.4.6', level: 'AA', title: 'Headings and Labels',
    description: 'Headings and labels describe topic or purpose.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html',
  },
  '2.4.7': {
    id: '2.4.7', level: 'AA', title: 'Focus Visible',
    description: 'Any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html',
  },
  '2.4.11': {
    id: '2.4.11', level: 'AA', title: 'Focus Appearance (Minimum)',
    description: 'When a component receives keyboard focus, the focus indicator meets minimum size and contrast requirements. (New in WCAG 2.2)',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance-minimum.html',
  },
  '2.4.12': {
    id: '2.4.12', level: 'AAA', title: 'Focus Appearance',
    description: 'When a component receives keyboard focus, the focus indicator meets enhanced size and contrast requirements. (New in WCAG 2.2)',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html',
  },
  '2.5.3': {
    id: '2.5.3', level: 'A', title: 'Label in Name',
    description: 'For user interface components with labels that include text or images of text, the name contains the text that is presented visually.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html',
  },
  '2.5.7': {
    id: '2.5.7', level: 'AA', title: 'Dragging Movements',
    description: 'All functionality that uses a dragging movement for operation can be achieved with a single pointer without dragging. (New in WCAG 2.2)',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html',
  },
  '2.5.8': {
    id: '2.5.8', level: 'AA', title: 'Target Size (Minimum)',
    description: 'The size of the target for pointer inputs is at least 24 by 24 CSS pixels. (New in WCAG 2.2)',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
  },
  '1.4.3': {
    id: '1.4.3', level: 'AA', title: 'Contrast (Minimum)',
    description: 'The visual presentation of text and images of text has a contrast ratio of at least 4.5:1 (or 3:1 for large text).',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
  },
  '2.4.2': {
    id: '2.4.2', level: 'A', title: 'Page Titled',
    description: 'Web pages have titles that describe their topic or purpose.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html',
  },
  '3.1.1': {
    id: '3.1.1', level: 'A', title: 'Language of Page',
    description: 'The default human language of each page can be programmatically determined.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html',
  },
  '3.2.1': {
    id: '3.2.1', level: 'A', title: 'On Focus',
    description: 'If any component receives focus, it does not initiate a change of context.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html',
  },
  '3.2.2': {
    id: '3.2.2', level: 'A', title: 'On Input',
    description: 'Changing a UI component does not automatically cause a change of context unless the user has been advised of the behavior beforehand.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/on-input.html',
  },
  '3.2.6': {
    id: '3.2.6', level: 'A', title: 'Consistent Help',
    description: 'If a page provides help mechanisms, they occur in a consistent location. (New in WCAG 2.2)',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html',
  },
  '3.3.1': {
    id: '3.3.1', level: 'A', title: 'Error Identification',
    description: 'If an input error is automatically detected, the item that is in error is identified and the error is described to the user in text.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html',
  },
  '3.3.2': {
    id: '3.3.2', level: 'A', title: 'Labels or Instructions',
    description: 'Labels or instructions are provided when content requires user input.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
  },
  '3.3.7': {
    id: '3.3.7', level: 'A', title: 'Redundant Entry',
    description: 'Information previously entered is either auto-populated or available for selection. (New in WCAG 2.2)',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html',
  },
  '3.3.8': {
    id: '3.3.8', level: 'AA', title: 'Accessible Authentication (Minimum)',
    description: 'A cognitive function test is not required for any step of an authentication process unless alternatives are provided. (New in WCAG 2.2)',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html',
  },
  '3.3.9': {
    id: '3.3.9', level: 'AAA', title: 'Accessible Authentication (Enhanced)',
    description: 'A cognitive function test is not required for any step of an authentication process. (New in WCAG 2.2)',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-enhanced.html',
  },
  '4.1.2': {
    id: '4.1.2', level: 'A', title: 'Name, Role, Value',
    description: 'For all user interface components, the name, role, and value can be programmatically determined.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
  },
  '4.1.3': {
    id: '4.1.3', level: 'AA', title: 'Status Messages',
    description: 'In content implemented using markup languages, status messages can be programmatically determined.',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html',
  },
};

// ─── ESLint Rule → WCAG Mapping ───────────────────────────────────────────────

export const RULE_TO_WCAG: Record<string, WcagRuleMapping> = {
  // ── Level A: Core accessibility ────────────────────────────────────────────
  'jsx-a11y/alt-text': {
    criterion: '1.1.1', level: 'A', title: 'Non-text Content', severity: 'critical',
    url: WCAG_CRITERIA['1.1.1'].url,
  },
  'jsx-a11y/img-redundant-alt': {
    criterion: '1.1.1', level: 'A', title: 'Non-text Content', severity: 'critical',
    url: WCAG_CRITERIA['1.1.1'].url,
  },
  'jsx-a11y/media-has-caption': {
    criterion: '1.2.2', level: 'A', title: 'Captions (Prerecorded)', severity: 'critical',
    url: WCAG_CRITERIA['1.2.2'].url,
  },
  'jsx-a11y/heading-has-content': {
    criterion: '1.3.1', level: 'A', title: 'Info and Relationships', severity: 'critical',
    url: WCAG_CRITERIA['1.3.1'].url,
  },
  'jsx-a11y/label-has-associated-control': {
    criterion: '1.3.1', level: 'A', title: 'Info and Relationships', severity: 'critical',
    url: WCAG_CRITERIA['1.3.1'].url,
  },
  'jsx-a11y/scope': {
    criterion: '1.3.1', level: 'A', title: 'Info and Relationships', severity: 'serious',
    url: WCAG_CRITERIA['1.3.1'].url,
  },
  'jsx-a11y/click-events-have-key-events': {
    criterion: '2.1.1', level: 'A', title: 'Keyboard', severity: 'critical',
    url: WCAG_CRITERIA['2.1.1'].url,
  },
  'jsx-a11y/mouse-events-have-key-events': {
    criterion: '2.1.1', level: 'A', title: 'Keyboard', severity: 'critical',
    url: WCAG_CRITERIA['2.1.1'].url,
  },
  'jsx-a11y/interactive-supports-focus': {
    criterion: '2.1.1', level: 'A', title: 'Keyboard', severity: 'critical',
    url: WCAG_CRITERIA['2.1.1'].url,
  },
  'jsx-a11y/no-noninteractive-tabindex': {
    criterion: '2.1.1', level: 'A', title: 'Keyboard', severity: 'serious',
    url: WCAG_CRITERIA['2.1.1'].url,
  },
  'jsx-a11y/no-access-key': {
    criterion: '2.1.4', level: 'A', title: 'Character Key Shortcuts', severity: 'critical',
    url: WCAG_CRITERIA['2.1.4'].url,
  },
  'jsx-a11y/no-distracting-elements': {
    criterion: '2.2.2', level: 'A', title: 'Pause, Stop, Hide', severity: 'critical',
    url: WCAG_CRITERIA['2.2.2'].url,
  },
  'jsx-a11y/tabindex-no-positive': {
    criterion: '2.4.3', level: 'A', title: 'Focus Order', severity: 'serious',
    url: WCAG_CRITERIA['2.4.3'].url,
  },
  'jsx-a11y/anchor-has-content': {
    criterion: '2.4.4', level: 'A', title: 'Link Purpose (In Context)', severity: 'critical',
    url: WCAG_CRITERIA['2.4.4'].url,
  },
  'jsx-a11y/anchor-is-valid': {
    criterion: '2.4.4', level: 'A', title: 'Link Purpose (In Context)', severity: 'critical',
    url: WCAG_CRITERIA['2.4.4'].url,
  },
  'jsx-a11y/html-has-lang': {
    criterion: '3.1.1', level: 'A', title: 'Language of Page', severity: 'critical',
    url: WCAG_CRITERIA['3.1.1'].url,
  },
  'jsx-a11y/lang': {
    criterion: '3.1.1', level: 'A', title: 'Language of Page', severity: 'critical',
    url: WCAG_CRITERIA['3.1.1'].url,
  },
  'jsx-a11y/no-autofocus': {
    criterion: '3.2.1', level: 'A', title: 'On Focus', severity: 'minor',
    url: WCAG_CRITERIA['3.2.1'].url,
  },
  'jsx-a11y/aria-activedescendant-has-tabindex': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'critical',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'jsx-a11y/aria-props': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'critical',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'jsx-a11y/aria-proptypes': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'critical',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'jsx-a11y/aria-role': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'critical',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'jsx-a11y/aria-unsupported-elements': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'critical',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'jsx-a11y/iframe-has-title': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'critical',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'jsx-a11y/no-interactive-element-to-noninteractive-role': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'critical',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'jsx-a11y/no-noninteractive-element-interactions': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'serious',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'jsx-a11y/no-noninteractive-element-to-interactive-role': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'critical',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'jsx-a11y/no-redundant-roles': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'minor',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'jsx-a11y/no-static-element-interactions': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'serious',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'jsx-a11y/prefer-tag-over-role': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'minor',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'jsx-a11y/role-has-required-aria-props': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'critical',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'jsx-a11y/role-supports-aria-props': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'critical',
    url: WCAG_CRITERIA['4.1.2'].url,
  },

  // ── Level AA ───────────────────────────────────────────────────────────────
  'jsx-a11y/autocomplete-valid': {
    criterion: '1.3.5', level: 'AA', title: 'Identify Input Purpose', severity: 'serious',
    url: WCAG_CRITERIA['1.3.5'].url,
  },

  // ── Custom checks (Babel AST pass) ─────────────────────────────────────────
  'custom/svg-missing-accessible-name': {
    criterion: '1.1.1', level: 'A', title: 'Non-text Content', severity: 'critical',
    url: WCAG_CRITERIA['1.1.1'].url,
  },
  'custom/table-missing-caption': {
    criterion: '1.3.1', level: 'A', title: 'Info and Relationships', severity: 'serious',
    url: WCAG_CRITERIA['1.3.1'].url,
  },
  'custom/onclick-without-keyboard': {
    criterion: '2.1.1', level: 'A', title: 'Keyboard', severity: 'critical',
    url: WCAG_CRITERIA['2.1.1'].url,
  },
  'custom/role-button-no-keyboard': {
    criterion: '2.1.1', level: 'A', title: 'Keyboard', severity: 'critical',
    url: WCAG_CRITERIA['2.1.1'].url,
  },
  'custom/positive-tabindex': {
    criterion: '2.4.3', level: 'A', title: 'Focus Order', severity: 'serious',
    url: WCAG_CRITERIA['2.4.3'].url,
  },
  'custom/focus-outline-removed': {
    criterion: '2.4.7', level: 'AA', title: 'Focus Visible', severity: 'serious',
    url: WCAG_CRITERIA['2.4.7'].url,
  },
  'custom/target-size-small': {
    criterion: '2.5.8', level: 'AA', title: 'Target Size (Minimum)', severity: 'serious',
    url: WCAG_CRITERIA['2.5.8'].url,
  },
  // ── HTML-file checks ───────────────────────────────────────────────────────
  'custom/missing-html-lang': {
    criterion: '3.1.1', level: 'A', title: 'Language of Page', severity: 'critical',
    url: WCAG_CRITERIA['3.1.1'].url,
  },
  'custom/missing-page-title': {
    criterion: '2.4.2', level: 'A', title: 'Page Titled', severity: 'critical',
    url: WCAG_CRITERIA['2.4.2'].url,
  },
  'custom/nondescriptive-page-title': {
    criterion: '2.4.2', level: 'A', title: 'Page Titled', severity: 'serious',
    url: WCAG_CRITERIA['2.4.2'].url,
  },
  // ── App-level checks ───────────────────────────────────────────────────────
  'custom/skip-link-missing': {
    criterion: '2.4.1', level: 'A', title: 'Bypass Blocks', severity: 'critical',
    url: WCAG_CRITERIA['2.4.1'].url,
  },
  // ── Additional AST checks ──────────────────────────────────────────────────
  'custom/new-tab-no-warning': {
    criterion: '3.2.2', level: 'A', title: 'On Input', severity: 'serious',
    url: WCAG_CRITERIA['3.2.2'].url,
  },
  'custom/low-color-contrast': {
    criterion: '1.4.3', level: 'AA', title: 'Contrast (Minimum)', severity: 'serious',
    url: WCAG_CRITERIA['1.4.3'].url,
  },
  // ── Extended AST checks (Session 3) ────────────────────────────────────────
  'custom/nondescriptive-alt-text': {
    criterion: '1.1.1', level: 'A', title: 'Non-text Content', severity: 'serious',
    url: WCAG_CRITERIA['1.1.1'].url,
  },
  'custom/generic-link-text': {
    criterion: '2.4.4', level: 'A', title: 'Link Purpose (In Context)', severity: 'serious',
    url: WCAG_CRITERIA['2.4.4'].url,
  },
  'custom/heading-level-skip': {
    criterion: '1.3.1', level: 'A', title: 'Info and Relationships', severity: 'serious',
    url: WCAG_CRITERIA['1.3.1'].url,
  },
  'custom/th-missing-scope': {
    criterion: '1.3.1', level: 'A', title: 'Info and Relationships', severity: 'serious',
    url: WCAG_CRITERIA['1.3.1'].url,
  },
  'custom/video-autoplay': {
    criterion: '2.2.2', level: 'A', title: 'Pause, Stop, Hide', severity: 'serious',
    url: WCAG_CRITERIA['2.2.2'].url,
  },
  'custom/video-missing-controls': {
    criterion: '1.2.1', level: 'A', title: 'Audio-only and Video-only (Prerecorded)', severity: 'critical',
    url: WCAG_CRITERIA['1.2.1'].url,
  },
  'custom/icon-button-no-label': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'critical',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
  'custom/input-missing-label': {
    criterion: '3.3.2', level: 'A', title: 'Labels or Instructions', severity: 'critical',
    url: WCAG_CRITERIA['3.3.2'].url,
  },
  // ── App-level landmark checks ───────────────────────────────────────────────
  'custom/missing-main-landmark': {
    criterion: '1.3.1', level: 'A', title: 'Info and Relationships', severity: 'serious',
    url: WCAG_CRITERIA['1.3.1'].url,
  },
  'custom/missing-nav-landmark': {
    criterion: '1.3.1', level: 'A', title: 'Info and Relationships', severity: 'serious',
    url: WCAG_CRITERIA['1.3.1'].url,
  },
  'custom/missing-dialog-role': {
    criterion: '4.1.2', level: 'A', title: 'Name, Role, Value', severity: 'serious',
    url: WCAG_CRITERIA['4.1.2'].url,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getCriterion(id: string): WcagCriterion | undefined {
  return WCAG_CRITERIA[id];
}

export function getRuleMapping(ruleId: string): WcagRuleMapping | undefined {
  return RULE_TO_WCAG[ruleId];
}

/** All WCAG 2.2 criterion IDs that are checkable via static analysis */
export const CHECKABLE_CRITERIA = new Set(
  Object.values(RULE_TO_WCAG).map((m) => m.criterion),
);

/** Total WCAG 2.2 criteria by level (for pass-rate computation) */
export const CRITERIA_COUNTS: Record<WcagLevel, number> = {
  A: Object.values(WCAG_CRITERIA).filter((c) => c.level === 'A').length,
  AA: Object.values(WCAG_CRITERIA).filter((c) => c.level === 'AA').length,
  AAA: Object.values(WCAG_CRITERIA).filter((c) => c.level === 'AAA').length,
};
