import PDFDocument from 'pdfkit';
import type { ReportResult, Severity, OverallLevel } from '../types.js';

// ─── Design tokens ────────────────────────────────────────────────────────────

const BRAND = {
  primary: '#1E3A5F',    // dark navy
  accent: '#2563EB',     // blue
  light: '#F1F5F9',      // light slate bg
  border: '#CBD5E1',     // slate-300
  text: '#1E293B',       // slate-900
  muted: '#64748B',      // slate-500
  white: '#FFFFFF',
};

const SEVERITY_COLOR: Record<Severity, { bg: string; text: string; badge: string }> = {
  critical: { bg: '#FEF2F2', text: '#991B1B', badge: '#DC2626' },
  serious:  { bg: '#FFF7ED', text: '#9A3412', badge: '#EA580C' },
  moderate: { bg: '#FFFBEB', text: '#92400E', badge: '#D97706' },
  minor:    { bg: '#F8FAFC', text: '#374151', badge: '#6B7280' },
};

const LEVEL_COLOR: Record<OverallLevel, string> = {
  'AAA':           '#15803D',
  'AA':            '#1D4ED8',
  'Partial AA':    '#B45309',
  'Non-compliant': '#B91C1C',
};

const PAGE = { width: 595.28, height: 841.89, margin: 45 }; // A4
const CONTENT_W = PAGE.width - PAGE.margin * 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > PAGE.height - PAGE.margin - 20) {
    doc.addPage();
  }
}

function sectionRule(doc: PDFKit.PDFDocument): void {
  doc
    .moveTo(PAGE.margin, doc.y)
    .lineTo(PAGE.width - PAGE.margin, doc.y)
    .strokeColor(BRAND.border)
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.4);
}

function coloredBadge(
  doc: PDFKit.PDFDocument,
  label: string,
  color: string,
  x: number,
  y: number,
): void {
  const pad = 5;
  doc.fontSize(9).font('Helvetica-Bold');
  const w = doc.widthOfString(label) + pad * 2;
  doc.roundedRect(x, y, w, 14, 3).fill(color);
  doc.fillColor(BRAND.white).text(label, x + pad, y + 2.5, { lineBreak: false });
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildHeader(doc: PDFKit.PDFDocument, report: ReportResult): void {
  // Full-width navy banner
  doc
    .rect(0, 0, PAGE.width, 80)
    .fill(BRAND.primary);

  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor(BRAND.white)
    .text('Accessibility Report', PAGE.margin, 20, { lineBreak: false });

  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#94A3B8')
    .text('WCAG 2.2 AA / AAA Static Analysis', PAGE.margin, 48, { lineBreak: false });

  // Scan date top-right
  doc
    .fillColor('#94A3B8')
    .text(
      new Date(report.meta.scanned_at).toUTCString(),
      PAGE.margin,
      48,
      { align: 'right', lineBreak: false },
    );

  doc.y = 95;
}

function buildRepoBlock(doc: PDFKit.PDFDocument, report: ReportResult): void {
  doc
    .rect(PAGE.margin, doc.y, CONTENT_W, 44)
    .fill(BRAND.light);

  const y0 = doc.y + 8;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.muted).text('REPOSITORY', PAGE.margin + 10, y0, { lineBreak: false });
  doc.font('Helvetica').fontSize(10).fillColor(BRAND.text)
    .text(report.meta.repo_url, PAGE.margin + 10, y0 + 12, { lineBreak: false });

  // Branch / Files
  const mid = PAGE.margin + CONTENT_W / 2;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.muted)
    .text('BRANCH', mid, y0, { lineBreak: false });
  doc.font('Helvetica').fontSize(10).fillColor(BRAND.text)
    .text(report.meta.branch, mid, y0 + 12, { lineBreak: false });

  const right = PAGE.margin + (CONTENT_W * 3) / 4;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.muted)
    .text('FILES SCANNED', right, y0, { lineBreak: false });
  doc.font('Helvetica').fontSize(10).fillColor(BRAND.text)
    .text(String(report.meta.total_files_scanned), right, y0 + 12, { lineBreak: false });

  doc.y += 52;
  doc.moveDown(0.5);
}

function buildComplianceBanner(doc: PDFKit.PDFDocument, report: ReportResult): void {
  const { overall_level, a_pass_rate, aa_pass_rate, aaa_pass_rate, total_issues } = report.summary;
  const levelColor = LEVEL_COLOR[overall_level];

  // Outer card — taller to accommodate two rows
  doc
    .rect(PAGE.margin, doc.y, CONTENT_W, 84)
    .fill(BRAND.light);

  const y0 = doc.y + 10;

  // ── Row 1: Overall compliance + Total issues ─────────────────────────────
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.muted)
    .text('OVERALL COMPLIANCE', PAGE.margin + 10, y0, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(18).fillColor(levelColor)
    .text(overall_level, PAGE.margin + 10, y0 + 12, { lineBreak: false });

  const colRight = PAGE.margin + CONTENT_W * 0.78;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.muted)
    .text('TOTAL ISSUES', colRight, y0, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(18).fillColor(total_issues === 0 ? '#15803D' : BRAND.text)
    .text(String(total_issues), colRight, y0 + 12, { lineBreak: false });

  // ── Row 2: A / AA / AAA pass rates ──────────────────────────────────────
  const y1 = y0 + 40;

  // A pass rate
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.muted)
    .text('A PASS RATE', PAGE.margin + 10, y1, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(15).fillColor(a_pass_rate === 100 ? '#15803D' : '#DC2626')
    .text(`${a_pass_rate}%`, PAGE.margin + 10, y1 + 12, { lineBreak: false });

  // AA pass rate
  const colAA = PAGE.margin + CONTENT_W * 0.33;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.muted)
    .text('AA PASS RATE', colAA, y1, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(15).fillColor(aa_pass_rate === 100 ? '#15803D' : levelColor)
    .text(`${aa_pass_rate}%`, colAA, y1 + 12, { lineBreak: false });

  // AAA pass rate
  const colAAA = PAGE.margin + CONTENT_W * 0.62;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.muted)
    .text('AAA PASS RATE', colAAA, y1, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(15).fillColor(BRAND.accent)
    .text(`${aaa_pass_rate}%`, colAAA, y1 + 12, { lineBreak: false });

  doc.y += 92;
  doc.moveDown(0.5);
}

function buildStatsGrid(doc: PDFKit.PDFDocument, report: ReportResult): void {
  const { issues_by_severity: sev, issues_by_wcag_level: lvl } = report.summary;
  const halfW = (CONTENT_W - 10) / 2;
  const cardH = 120;
  const y0 = doc.y;

  // ── Left card: by severity ─────────────────────────────────────────────────
  doc.rect(PAGE.margin, y0, halfW, cardH).fill(BRAND.white);
  doc.rect(PAGE.margin, y0, halfW, cardH).stroke(BRAND.border).lineWidth(0.5);

  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.muted)
    .text('ISSUES BY SEVERITY', PAGE.margin + 10, y0 + 10, { lineBreak: false });

  const sevRows: [Severity, number][] = [
    ['critical', sev.critical],
    ['serious',  sev.serious],
    ['moderate', sev.moderate],
    ['minor',    sev.minor],
  ];
  sevRows.forEach(([s, count], i) => {
    const ry = y0 + 26 + i * 20;
    const col = SEVERITY_COLOR[s];
    doc.rect(PAGE.margin + 10, ry + 2, 8, 8).fill(col.badge);
    doc.font('Helvetica').fontSize(10).fillColor(BRAND.text)
      .text(`${s.charAt(0).toUpperCase() + s.slice(1)}`, PAGE.margin + 25, ry, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.text)
      .text(String(count), PAGE.margin + halfW - 30, ry, { lineBreak: false });
  });

  // divider + total
  doc.moveTo(PAGE.margin + 10, y0 + 106).lineTo(PAGE.margin + halfW - 10, y0 + 106)
    .strokeColor(BRAND.border).lineWidth(0.5).stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.text)
    .text('Total', PAGE.margin + 25, y0 + 108, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.primary)
    .text(String(report.summary.total_issues), PAGE.margin + halfW - 30, y0 + 108, { lineBreak: false });

  // ── Right card: by WCAG level ──────────────────────────────────────────────
  const rx = PAGE.margin + halfW + 10;
  doc.rect(rx, y0, halfW, cardH).fill(BRAND.white);
  doc.rect(rx, y0, halfW, cardH).stroke(BRAND.border).lineWidth(0.5);

  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.muted)
    .text('ISSUES BY WCAG LEVEL', rx + 10, y0 + 10, { lineBreak: false });

  const lvlRows: [string, number, string][] = [
    ['Level A',   lvl.A,   '#DC2626'],
    ['Level AA',  lvl.AA,  '#EA580C'],
    ['Level AAA', lvl.AAA, '#6B7280'],
  ];
  lvlRows.forEach(([label, count, color], i) => {
    const ry = y0 + 26 + i * 20;
    doc.rect(rx + 10, ry + 2, 8, 8).fill(color);
    doc.font('Helvetica').fontSize(10).fillColor(BRAND.text)
      .text(label, rx + 25, ry, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.text)
      .text(String(count), rx + halfW - 30, ry, { lineBreak: false });
  });

  doc.y = y0 + cardH + 16;
  doc.moveDown(0.3);
}

function buildIssueEntry(
  doc: PDFKit.PDFDocument,
  issue: ReturnType<ReportResult['issues'][0]['severity']['charAt']> extends string
    ? ReportResult['issues'][0]
    : never,
  index: number,
): void {
  const col = SEVERITY_COLOR[issue.severity as Severity];

  // Estimate height needed
  const msgH = doc.heightOfString(issue.message, { width: CONTENT_W - 22 });
  const snippetLines = issue.code_snippet.split('\n').length;
  const estimatedH = 18 + 14 + 14 + msgH + snippetLines * 12 + 24;

  ensureSpace(doc, estimatedH + 10);

  const cardTop = doc.y;
  const cardLeft = PAGE.margin;

  // Left severity stripe
  doc.rect(cardLeft, cardTop, 4, estimatedH).fill(col.badge);

  // Card background (alternating)
  doc.rect(cardLeft + 4, cardTop, CONTENT_W - 4, estimatedH).fill(index % 2 === 0 ? BRAND.white : BRAND.light);

  const tx = cardLeft + 12;
  let ty = cardTop + 6;

  // Row 1: severity badge + WCAG criterion + title
  coloredBadge(doc, issue.severity.toUpperCase(), col.badge, tx, ty);
  const badgeW = doc.widthOfString(issue.severity.toUpperCase()) + 14;

  doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.text)
    .text(`${issue.wcag_criterion}  ${issue.wcag_title}`, tx + badgeW + 8, ty + 1, {
      lineBreak: false,
    });

  // WCAG level pill (right)
  coloredBadge(
    doc,
    `Level ${issue.wcag_level}`,
    issue.wcag_level === 'A' ? '#DC2626' : issue.wcag_level === 'AA' ? '#1D4ED8' : '#6B7280',
    PAGE.width - PAGE.margin - 56,
    ty,
  );

  ty += 18;

  // Row 2: file + line
  doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted)
    .text(`${issue.file}`, tx, ty, { lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted)
    .text(` · line ${issue.line}  ·  ${issue.rule_id}`, tx + doc.widthOfString(issue.file), ty, {
      lineBreak: false,
    });

  ty += 14;

  // Row 3: message
  doc.font('Helvetica').fontSize(10).fillColor(BRAND.text)
    .text(issue.message, tx, ty, { width: CONTENT_W - 24 });

  ty = doc.y + 4;

  // Code snippet box
  const snippetH = snippetLines * 11 + 8;
  doc.rect(tx, ty, CONTENT_W - 20, snippetH).fill('#F1F5F9');
  doc.font('Courier').fontSize(8).fillColor('#334155')
    .text(issue.code_snippet, tx + 6, ty + 4, { width: CONTENT_W - 32, lineBreak: true });

  doc.y = ty + snippetH + 8;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function renderPdf(report: ReportResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE.margin,
      autoFirstPage: false,
      info: {
        Title: `A11y Report — ${report.meta.repo_url}`,
        Author: 'a11y-static-scanner',
        Subject: 'WCAG 2.2 Accessibility Audit',
        CreationDate: new Date(report.meta.scanned_at),
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Page 1: cover + summary ──────────────────────────────────────────────
    doc.addPage();

    buildHeader(doc, report);
    buildRepoBlock(doc, report);
    sectionRule(doc);
    buildComplianceBanner(doc, report);
    sectionRule(doc);
    buildStatsGrid(doc, report);

    // ── Issues section ───────────────────────────────────────────────────────
    if (report.issues.length > 0) {
      sectionRule(doc);

      doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND.primary)
        .text(`DETAILED ISSUES  (${report.issues.length} total)`, PAGE.margin, doc.y);
      doc.moveDown(0.5);

      for (let i = 0; i < report.issues.length; i++) {
        buildIssueEntry(doc, report.issues[i] as any, i);
      }
    } else {
      doc.moveDown(1);
      doc
        .rect(PAGE.margin, doc.y, CONTENT_W, 50)
        .fill('#F0FDF4');
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#15803D')
        .text('🎉  No accessibility issues found!', PAGE.margin, doc.y + 16, { align: 'center' });
      doc.y += 58;
    }

    // ── Page footer on every page ────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(BRAND.muted)
        .text(
          `Generated by a11y-static-scanner  ·  WCAG 2.2  ·  Page ${i + 1} of ${range.count}`,
          PAGE.margin,
          PAGE.height - 30,
          { align: 'center', lineBreak: false },
        );
    }

    doc.end();
  });
}
