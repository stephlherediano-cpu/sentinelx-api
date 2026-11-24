
import { z } from 'zod';

export const transactionSchema = z.object({
  chainId: z.number()
    .int()
    .refine((id) => [56, 1, 137, 42161].includes(id), {
      message: 'Unsupported blockchain network',
    }),

  from: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid sender address'),

  to: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid recipient address'),

  value: z.string()
    .max(80)
    .regex(/^(0x[a-fA-F0-9]+|[0-9]+)$/)
    .default('0'),

  data: z.string()
    .max(200002)
    .regex(/^0x([a-fA-F0-9]{2})*$/)
    .default('0x'),
}).strict();

export type TransactionInput = z.infer<typeof transactionSchema>;
