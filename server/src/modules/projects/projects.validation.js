import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name is too long').trim(),
  allowed_domains: z.string().optional().default('*'),
  webhook_url: z.string().url('Must be a valid URL (e.g. Slack/Discord webhook)').or(z.literal('')).optional(),
  github_repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'Repository must be in format owner/repo').or(z.literal('')).optional().nullable(),
  github_token: z.string().min(1).or(z.literal('')).optional().nullable(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name cannot be empty').max(100).trim().optional(),
  allowed_domains: z.string().trim().optional(),
  webhook_url: z.string().url('Must be a valid URL').or(z.literal('')).optional().nullable(),
  github_repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'Repository must be in format owner/repo').or(z.literal('')).optional().nullable(),
  github_token: z.string().min(1).or(z.literal('')).optional().nullable(),
});
