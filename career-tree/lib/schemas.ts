import { z } from "zod";

export const V2NodeIdSchema = z.string().regex(
  /^(school_stage|stream|exam|degree|diploma|certification|training|job_role|government_service|entrepreneurship):[a-z0-9]+(?:-[a-z0-9]+)*$/,
  "A valid V2 node ID is required",
);

export const SuggestionSchema = z.object({
  parentNodeId: V2NodeIdSchema,
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(10).max(1000),
}).strict();

export const EditableNodeDataSchema = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().min(10).max(4000),
  aliases: z.array(z.string().trim().min(1).max(150)).max(25),
}).strict();

export const EditSubmissionSchema = z.object({
  targetNodeId: V2NodeIdSchema,
  proposedData: EditableNodeDataSchema,
}).strict();
