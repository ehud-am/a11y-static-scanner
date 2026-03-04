#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ZodError } from 'zod';

import { AnalyzeRepoSchema, handleAnalyzeRepo } from './tools/analyze-repo.js';
import { AnalyzeLocalSchema, handleAnalyzeLocal } from './tools/analyze-local.js';
import { WcagDetailSchema, handleWcagDetail } from './tools/wcag-detail.js';

// ─── Server definition ────────────────────────────────────────────────────────

const server = new Server(
  { name: 'a11y-static-scanner', version: '1.2.0' },
  { capabilities: { tools: {} } },
);

// ─── Tool catalogue ───────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'analyze_repo',
      description:
        'Download a GitHub or GitLab repository, discover all React UI files, ' +
        'and run a WCAG 2.2 AA/AAA accessibility audit. ' +
        'Returns a compliance report in JSON, Markdown, PDF, or Excel format.',
      inputSchema: {
        type: 'object',
        properties: {
          repo_url: {
            type: 'string',
            description:
              'Full HTTPS URL of the repository (e.g. https://github.com/org/repo)',
          },
          token: {
            type: 'string',
            description: 'Personal access token for private repositories (optional).',
          },
          branch: {
            type: 'string',
            description: 'Branch to scan. Defaults to the repository default branch.',
          },
          path_filter: {
            type: 'string',
            description:
              'Optional glob to restrict the scan (e.g. "src/components/**"). ' +
              'Relative to repo root.',
          },
          format: {
            type: 'string',
            enum: ['json', 'markdown', 'pdf', 'excel'],
            description:
              'Output format. ' +
              '"json" (default) returns structured data. ' +
              '"markdown" returns a human-readable text report. ' +
              '"pdf" saves a formatted PDF and returns the file path. ' +
              '"excel" saves an Excel workbook (.xlsx) and returns the file path.',
          },
          output_path: {
            type: 'string',
            description:
              'Absolute path where the PDF or Excel file should be saved. ' +
              'Only applies when format is "pdf" or "excel". ' +
              'Defaults to a timestamped file in the system temp directory.',
          },
        },
        required: ['repo_url'],
      },
    },
    {
      name: 'analyze_local_path',
      description:
        'Scan a local folder on disk, discover all React UI files, ' +
        'and run a WCAG 2.2 AA/AAA accessibility audit. ' +
        'Returns a compliance report in JSON, Markdown, PDF, or Excel format. ' +
        'Use this instead of analyze_repo when the project is already on the local filesystem.',
      inputSchema: {
        type: 'object',
        properties: {
          local_path: {
            type: 'string',
            description:
              'Absolute or relative path to the local folder to scan ' +
              '(e.g. /home/user/my-app or ./frontend)',
          },
          path_filter: {
            type: 'string',
            description:
              'Optional glob to restrict the scan (e.g. "src/components/**"). ' +
              'Relative to the folder root.',
          },
          format: {
            type: 'string',
            enum: ['json', 'markdown', 'pdf', 'excel'],
            description:
              'Output format. ' +
              '"json" (default) returns structured data. ' +
              '"markdown" returns a human-readable text report. ' +
              '"pdf" saves a formatted PDF and returns the file path. ' +
              '"excel" saves an Excel workbook (.xlsx) and returns the file path.',
          },
          output_path: {
            type: 'string',
            description:
              'Absolute path where the PDF or Excel file should be saved. ' +
              'Only applies when format is "pdf" or "excel". ' +
              'Defaults to a timestamped file in the system temp directory.',
          },
        },
        required: ['local_path'],
      },
    },
    {
      name: 'get_wcag_rule_detail',
      description:
        'Return the full description, level, and W3C documentation link for a specific ' +
        'WCAG 2.2 success criterion.',
      inputSchema: {
        type: 'object',
        properties: {
          criterion_id: {
            type: 'string',
            description: 'WCAG 2.2 criterion ID, e.g. "1.1.1", "2.4.11", "2.5.8".',
          },
        },
        required: ['criterion_id'],
      },
    },
  ],
}));

// ─── Tool dispatcher ──────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'analyze_repo': {
        const input = AnalyzeRepoSchema.parse(args);
        const result = await handleAnalyzeRepo(input);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'analyze_local_path': {
        const input = AnalyzeLocalSchema.parse(args);
        const result = await handleAnalyzeLocal(input);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'get_wcag_rule_detail': {
        const input = WcagDetailSchema.parse(args);
        const result = handleWcagDetail(input);
        return { content: [{ type: 'text', text: result }] };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: "${name}"`);
    }
  } catch (err) {
    if (err instanceof McpError) throw err;

    if (err instanceof ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    throw new McpError(ErrorCode.InternalError, `Tool "${name}" failed: ${message}`);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[a11y-static-scanner] Server running on stdio\n');
}

main().catch((err) => {
  process.stderr.write(`[a11y-static-scanner] Fatal error: ${err}\n`);
  process.exit(1);
});
