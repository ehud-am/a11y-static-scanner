import ExcelJS from 'exceljs';
import type { ReportResult, Severity, OverallLevel } from '../types.js';

// ─── Design tokens ────────────────────────────────────────────────────────────

const SEVERITY_FILL: Record<Severity, string> = {
  critical: 'FFDC2626',  // red-600
  serious:  'FFEA580C',  // orange-600
  moderate: 'FFD97706',  // amber-600
  minor:    'FF6B7280',  // slate-500
};

const SEVERITY_TEXT_COLOR: Record<Severity, string> = {
  critical: 'FFFFFFFF',
  serious:  'FFFFFFFF',
  moderate: 'FFFFFFFF',
  minor:    'FFFFFFFF',
};

const LEVEL_FILL: Record<OverallLevel, string> = {
  'AAA':           'FF15803D',  // green-700
  'AA':            'FF1D4ED8',  // blue-700
  'Partial AA':    'FFB45309',  // amber-700
  'Non-compliant': 'FFB91C1C',  // red-700
};

const WCAG_LEVEL_FILL: Record<'A' | 'AA' | 'AAA', string> = {
  A:   'FFDC2626',
  AA:  'FF1D4ED8',
  AAA: 'FF6B7280',
};

const HEADER_BG    = 'FF1E3A5F';  // brand navy
const SECTION_BG   = 'FFE2E8F0';  // slate-200
const ALT_ROW_BG   = 'FFF8FAFC';  // near-white
const BORDER_COLOR = 'FFCBD5E1';

// ─── Style helpers ────────────────────────────────────────────────────────────

type FillStyle = ExcelJS.FillPattern;
type FontStyle = Partial<ExcelJS.Font>;
type AlignStyle = Partial<ExcelJS.Alignment>;

function solidFill(argb: string): FillStyle {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side = { style: 'thin' as const, color: { argb: BORDER_COLOR } };
  return { top: side, left: side, bottom: side, right: side };
}

function applyHeaderStyle(cell: ExcelJS.Cell, text: string): void {
  cell.value = text;
  cell.fill = solidFill(HEADER_BG);
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
  cell.border = thinBorder();
}

function applySectionHeader(cell: ExcelJS.Cell, text: string): void {
  cell.value = text;
  cell.fill = solidFill(SECTION_BG);
  cell.font = { bold: true, size: 10, color: { argb: 'FF1E293B' } };
  cell.alignment = { vertical: 'middle' };
}

function applyColorBadge(cell: ExcelJS.Cell, text: string, fillArgb: string): void {
  cell.value = text;
  cell.fill = solidFill(fillArgb);
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.border = thinBorder();
}

// ─── Summary sheet ────────────────────────────────────────────────────────────

function buildSummarySheet(wb: ExcelJS.Workbook, report: ReportResult): void {
  const ws = wb.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF1E3A5F' } },
  });

  ws.columns = [
    { width: 26 },
    { width: 45 },
    { width: 18 },
    { width: 18 },
  ];

  // ── Title row ──────────────────────────────────────────────────────────────
  ws.mergeCells('A1:D1');
  const titleCell = ws.getCell('A1');
  titleCell.value = '  A11y Accessibility Report — WCAG 2.2 AA / AAA';
  titleCell.fill = solidFill(HEADER_BG);
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 36;

  // ── Metadata block ─────────────────────────────────────────────────────────
  const meta: [string, string][] = [
    ['Repository', report.meta.repo_url],
    ['Branch',     report.meta.branch],
    ['Scanned at', new Date(report.meta.scanned_at).toUTCString()],
    ['Files scanned', String(report.meta.total_files_scanned)],
  ];

  let row = 3;
  for (const [label, value] of meta) {
    ws.mergeCells(`B${row}:D${row}`);
    applySectionHeader(ws.getCell(`A${row}`), label);
    ws.getCell(`B${row}`).value = value;
    ws.getCell(`B${row}`).font = { size: 10 };
    ws.getCell(`B${row}`).alignment = { vertical: 'middle' };
    row++;
  }

  row++;  // blank

  // ── Compliance summary ──────────────────────────────────────────────────────
  ws.mergeCells(`A${row}:D${row}`);
  applySectionHeader(ws.getCell(`A${row}`), 'COMPLIANCE SUMMARY');
  ws.getRow(row).height = 20;
  row++;

  // Overall level (coloured)
  applySectionHeader(ws.getCell(`A${row}`), 'Overall Level');
  applyColorBadge(
    ws.getCell(`B${row}`),
    report.summary.overall_level,
    LEVEL_FILL[report.summary.overall_level],
  );
  ws.mergeCells(`B${row}:D${row}`);
  ws.getRow(row).height = 24;
  row++;

  // Pass rates
  const rates: [string, string][] = [
    ['AA Pass Rate',  `${report.summary.aa_pass_rate}%`],
    ['AAA Pass Rate', `${report.summary.aaa_pass_rate}%`],
    ['Total Issues',  String(report.summary.total_issues)],
  ];
  for (const [label, value] of rates) {
    applySectionHeader(ws.getCell(`A${row}`), label);
    ws.mergeCells(`B${row}:D${row}`);
    ws.getCell(`B${row}`).value = value;
    ws.getCell(`B${row}`).font = { bold: true, size: 11 };
    row++;
  }

  row++;

  // ── Issues by severity ─────────────────────────────────────────────────────
  ws.mergeCells(`A${row}:D${row}`);
  applySectionHeader(ws.getCell(`A${row}`), 'ISSUES BY SEVERITY');
  ws.getRow(row).height = 20;
  row++;

  const severities: Severity[] = ['critical', 'serious', 'moderate', 'minor'];
  for (const s of severities) {
    applySectionHeader(ws.getCell(`A${row}`), s.charAt(0).toUpperCase() + s.slice(1));
    const countCell = ws.getCell(`B${row}`);
    const count = report.summary.issues_by_severity[s];
    applyColorBadge(countCell, String(count), count > 0 ? SEVERITY_FILL[s] : 'FF6B7280');
    ws.mergeCells(`B${row}:D${row}`);
    row++;
  }

  row++;

  // ── Issues by WCAG level ───────────────────────────────────────────────────
  ws.mergeCells(`A${row}:D${row}`);
  applySectionHeader(ws.getCell(`A${row}`), 'ISSUES BY WCAG LEVEL');
  ws.getRow(row).height = 20;
  row++;

  const levels: Array<['A' | 'AA' | 'AAA', string]> = [
    ['A',   'Level A (Minimum)'],
    ['AA',  'Level AA (Standard)'],
    ['AAA', 'Level AAA (Enhanced)'],
  ];
  for (const [lvl, label] of levels) {
    applySectionHeader(ws.getCell(`A${row}`), label);
    const countCell = ws.getCell(`B${row}`);
    const count = report.summary.issues_by_wcag_level[lvl];
    applyColorBadge(countCell, String(count), count > 0 ? WCAG_LEVEL_FILL[lvl] : 'FF64748B');
    ws.mergeCells(`B${row}:D${row}`);
    row++;
  }
}

// ─── Issues sheet ─────────────────────────────────────────────────────────────

const ISSUE_COLUMNS: Array<{ header: string; key: string; width: number }> = [
  { header: 'Severity',       key: 'severity',       width: 12 },
  { header: 'WCAG Level',     key: 'wcag_level',     width: 11 },
  { header: 'Criterion',      key: 'wcag_criterion', width: 11 },
  { header: 'WCAG Title',     key: 'wcag_title',     width: 28 },
  { header: 'File',           key: 'file',           width: 38 },
  { header: 'Line',           key: 'line',           width: 7  },
  { header: 'Col',            key: 'column',         width: 7  },
  { header: 'Rule',           key: 'rule_id',        width: 38 },
  { header: 'Message',        key: 'message',        width: 55 },
  { header: 'Code Snippet',   key: 'code_snippet',   width: 55 },
  { header: 'WCAG URL',       key: 'wcag_url',       width: 18 },
];

function buildIssuesSheet(wb: ExcelJS.Workbook, report: ReportResult): void {
  const ws = wb.addWorksheet('Issues', {
    properties: { tabColor: { argb: 'FFDC2626' } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = ISSUE_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = solidFill(HEADER_BG);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = thinBorder();
  });

  // Add auto-filter
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: ISSUE_COLUMNS.length },
  };

  // Data rows
  for (let i = 0; i < report.issues.length; i++) {
    const issue = report.issues[i];
    const dataRow = ws.addRow({
      severity:       issue.severity,
      wcag_level:     issue.wcag_level,
      wcag_criterion: issue.wcag_criterion,
      wcag_title:     issue.wcag_title,
      file:           issue.file,
      line:           issue.line,
      column:         issue.column,
      rule_id:        issue.rule_id,
      message:        issue.message,
      code_snippet:   issue.code_snippet,
      wcag_url:       issue.wcag_url,
    });

    dataRow.height = 38;
    const isAlt = i % 2 === 1;

    dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      // Default row styling
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.font = { size: 10 };
      cell.border = {
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        left:   { style: 'thin', color: { argb: BORDER_COLOR } },
        right:  { style: 'thin', color: { argb: BORDER_COLOR } },
      };

      // Severity column: coloured badge
      if (colNum === 1) {
        applyColorBadge(cell, issue.severity.toUpperCase(), SEVERITY_FILL[issue.severity as Severity]);
        return;
      }

      // WCAG level column: coloured badge
      if (colNum === 2) {
        applyColorBadge(cell, issue.wcag_level, WCAG_LEVEL_FILL[issue.wcag_level as 'A' | 'AA' | 'AAA']);
        return;
      }

      // Code snippet: monospace font + light grey bg
      if (colNum === 10) {
        cell.font = { name: 'Courier New', size: 9 };
        cell.fill = solidFill(isAlt ? 'FFE2E8F0' : 'FFF1F5F9');
        return;
      }

      // WCAG URL: hyperlink
      if (colNum === 11) {
        cell.value = {
          text: `WCAG ${issue.wcag_criterion}`,
          hyperlink: issue.wcag_url,
        };
        cell.font = { size: 10, color: { argb: 'FF1D4ED8' }, underline: true };
        return;
      }

      // Alternate row background
      if (isAlt) {
        cell.fill = solidFill(ALT_ROW_BG);
      }
    });
  }
}

// ─── WCAG Coverage sheet ─────────────────────────────────────────────────────

function buildCoverageSheet(wb: ExcelJS.Workbook, report: ReportResult): void {
  const ws = wb.addWorksheet('WCAG Coverage', {
    properties: { tabColor: { argb: 'FF1D4ED8' } },
  });

  ws.columns = [
    { header: 'Criterion', key: 'id',    width: 12 },
    { header: 'Title',     key: 'title', width: 36 },
    { header: 'Level',     key: 'level', width: 10 },
    { header: 'Status',    key: 'status',width: 16 },
    { header: 'Issues',    key: 'count', width: 10 },
  ];

  // Header styling
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = solidFill(HEADER_BG);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder();
  });

  // Aggregate issues per criterion
  const criterionCount = new Map<string, { title: string; level: string; count: number }>();
  for (const issue of report.issues) {
    const existing = criterionCount.get(issue.wcag_criterion);
    if (existing) {
      existing.count++;
    } else {
      criterionCount.set(issue.wcag_criterion, {
        title: issue.wcag_title,
        level: issue.wcag_level,
        count: 1,
      });
    }
  }

  const rows = Array.from(criterionCount.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  for (let i = 0; i < rows.length; i++) {
    const [id, info] = rows[i];
    const dataRow = ws.addRow({
      id,
      title: info.title,
      level: info.level,
      status: 'Violations Found',
      count: info.count,
    });

    dataRow.height = 22;
    const isAlt = i % 2 === 1;

    dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.border = thinBorder();
      cell.alignment = { vertical: 'middle', wrapText: false };

      if (colNum === 3) {
        // Level badge
        applyColorBadge(cell, info.level, WCAG_LEVEL_FILL[info.level as 'A' | 'AA' | 'AAA']);
        return;
      }
      if (colNum === 4) {
        // Status: red pill
        cell.fill = solidFill('FFFEF2F2');
        cell.font = { bold: true, color: { argb: 'FF991B1B' }, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        return;
      }
      if (colNum === 5) {
        // Issue count: bold, centred
        cell.font = { bold: true, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        return;
      }
      if (isAlt) cell.fill = solidFill(ALT_ROW_BG);
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function renderExcel(report: ReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'a11y-static-scanner';
  wb.created = new Date(report.meta.scanned_at);
  wb.modified = new Date();

  buildSummarySheet(wb, report);
  buildIssuesSheet(wb, report);
  buildCoverageSheet(wb, report);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
