import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name is too long').trim(),
  allowed_domains: z.string().optional().default('*'),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name cannot be empty').max(100).trim().optional(),
  allowed_domains: z.string().trim().optional(),
});
