import { z } from 'zod';

const telemetryEventSchema = z.object({
  type: z.string(),
  timestamp: z.number().optional(),
}).passthrough();

export const ingestPayloadSchema = z.object({
  errorMessage: z.string().min(1, 'errorMessage is required').max(2000),
  errorType: z.string().optional().default('Error'),
  errorStack: z.string().optional().default(''),
  pageUrl: z.string().min(1, 'pageUrl is required').max(2000),
  userAgent: z.string().optional().default(''),
  viewport: z.string().optional().default('1440x900'),
  telemetry: z.array(telemetryEventSchema).optional().default([]),
});
