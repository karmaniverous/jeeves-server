/**
 * The `fileMutate` request body: one object with an `action` enum and the union of the actions' fields, each action's required fields checked by a refinement (catalog bodies must be Zod objects). Pure.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/** The mutation actions. */
export const FILE_MUTATION_ACTIONS = [
  'edit-block',
  'delete-block',
  'insert-block',
  'edit-cell',
  'toggle-checkbox',
] as const;

/** A mutation action. */
type FileMutationAction = (typeof FILE_MUTATION_ACTIONS)[number];

/** Fields each action requires. */
export const FILE_MUTATION_REQUIRED_FIELDS = {
  'edit-block': ['startLine', 'endLine', 'content'],
  'delete-block': ['startLine', 'endLine'],
  'insert-block': ['atLine', 'position', 'content'],
  'edit-cell': ['line', 'col', 'content'],
  'toggle-checkbox': ['index', 'checked'],
} as const satisfies Record<FileMutationAction, readonly string[]>;

/** A whole line number (1-based) or index. */
const whole = (description: string) =>
  z.number().int().optional().describe(description);

/** `fileMutate` body. */
export const fileMutateBodySchema = z
  .object({
    /** Mutation to perform. */
    action: z
      .enum(FILE_MUTATION_ACTIONS)
      .describe('Mutation action to perform'),
    /** First line of the block (edit-block, delete-block). */
    startLine: whole('Start line (1-based) for edit-block/delete-block'),
    /** Last line of the block (edit-block, delete-block). */
    endLine: whole('End line (1-based) for edit-block/delete-block'),
    /** New text (edit-block, insert-block, edit-cell). */
    content: z
      .string()
      .optional()
      .describe('Content for edit-block, insert-block, or edit-cell'),
    /** Target line (insert-block). */
    atLine: whole('Target line (1-based) for insert-block'),
    /** Insert before or after `atLine` (insert-block). */
    position: z
      .enum(['before', 'after'])
      .optional()
      .describe('Insert position for insert-block'),
    /** Insert context (insert-block): `table-row` adds no blank lines. */
    context: z
      .string()
      .optional()
      .describe('Optional context for insert-block (e.g. "table-row")'),
    /** Table line (edit-cell). */
    line: whole('Line number (1-based) for edit-cell'),
    /** Table column (edit-cell). */
    col: whole('Column index (0-based) for edit-cell'),
    /** Checkbox index (toggle-checkbox). */
    index: whole('Checkbox index (0-based) for toggle-checkbox'),
    /** Desired state (toggle-checkbox). */
    checked: z
      .boolean()
      .optional()
      .describe('Desired checked state for toggle-checkbox'),
  })
  .superRefine((body, ctx) => {
    for (const field of FILE_MUTATION_REQUIRED_FIELDS[body.action]) {
      if (body[field] === undefined)
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `${body.action} requires ${field}`,
        });
    }
  });

/** A parsed `fileMutate` body. */
export type FileMutateBody = z.infer<typeof fileMutateBodySchema>;
