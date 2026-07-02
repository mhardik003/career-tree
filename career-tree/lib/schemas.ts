import { z } from "zod";

// Zod schemas for the suggest/edit API routes. They live here rather than in the
// route files because route modules must only export handlers (extra exports can
// fail the Next build), and so client code can share them.

export const SuggestionSchema = z.object({
  title: z.string().min(5).max(50).trim(), // Must be 5-50 chars
  description: z.string().min(10).max(500).trim(), // Prevent massive text
  parentPath: z.string().min(1)
});

// Define the shape of the data inside "newData"
// .trim() removes whitespace, .max() prevents database spam
export const NodeDataSchema = z.object({
  node_title: z.string().min(3, "Title is required").max(100).trim(),
  description: z.string().min(1, "Description is required").max(2000).trim(),
  difficulty_rating: z.number().min(1).max(10),

  avg_cost_inr: z.string().max(100).trim().optional(),
  duration_years: z.string().max(100).trim().optional(),

  // Validate arrays of strings
  exams_to_give: z.array(z.string().trim()).optional().nullable(),
  certifications: z.array(z.string().trim()).optional().nullable(),
  qualifications_needed: z.array(z.string().trim()).optional().nullable(),
  top_colleges_or_companies: z.array(z.string().trim()).optional().nullable(),
  tools_and_resources: z.array(z.string().trim()).optional().nullable(),
  real_life_applications: z.array(z.string().trim()).optional().nullable(),
});

// Define the full API Request body
export const EditSubmissionSchema = z.object({
  nodeKey: z.string().min(1),
  originalData: NodeDataSchema,
  newData: NodeDataSchema,
});
