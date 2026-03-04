import { z } from 'zod';
import { getCriterion, WCAG_CRITERIA } from '../analysis/wcag-map.js';

export const WcagDetailSchema = z.object({
  criterion_id: z
    .string()
    .describe('WCAG 2.2 criterion ID (e.g. "1.1.1", "2.4.7", "2.5.8")'),
});

export type WcagDetailInput = z.infer<typeof WcagDetailSchema>;

export function handleWcagDetail(input: WcagDetailInput): string {
  const criterion = getCriterion(input.criterion_id);

  if (!criterion) {
    const available = Object.keys(WCAG_CRITERIA).sort().join(', ');
    return JSON.stringify({
      error: `Unknown criterion "${input.criterion_id}".`,
      available_criteria: available,
    });
  }

  return JSON.stringify(criterion, null, 2);
}
