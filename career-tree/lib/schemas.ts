import { z } from "zod";

const V2NodeIdSchema = z.string().regex(
  /^(school_stage|stream|exam|degree|diploma|certification|training|job_role|government_service|entrepreneurship):[a-z0-9]+(?:-[a-z0-9]+)*$/,
  "A valid V2 node ID is required",
);

// Characters the write path cannot carry. Postgres `text` cannot store U+0000
// (SQLSTATE 22P05, "\u0000 cannot be converted to text"), and an unpaired
// UTF-16 surrogate is not valid UTF-8, so PostgREST rejects the whole request
// body with PGRST102 before a row is ever built. Both pass every shape check a
// schema can make and both are invisible in the UI — pasted in from a PDF or a
// mis-encoded document, they used to reach Supabase and come back to the
// contributor as "Something went wrong. Please try again later." on a
// submission that looked perfectly fine on screen.
//
// Stripping rather than rejecting is deliberate: an error message about a
// character nobody can see is not actionable, and the database's own dedup keys
// (`suggestion_dedup_key`, supabase/schema.sql) already treat invisible
// characters as noise rather than content.
//
// The surrogate halves need the lookahead AND the lookbehind. A high surrogate
// is only orphaned when no low surrogate follows it, and in a high-high-low run
// (U+D83D followed by a rocket emoji) the trailing pair is legitimate — a
// blanket [\uD800-\uDFFF] strip would destroy every emoji.
const UNSTORABLE_CHARS =
  /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

// Strip before the length checks, so the limits apply to the text that will
// actually be stored and a value left empty by stripping fails min() as an
// ordinary 400 instead of inserting a blank row.
const submittedText = (min: number, max: number) =>
  z
    .string()
    .transform((value) => value.replace(UNSTORABLE_CHARS, ""))
    .pipe(z.string().trim().min(min).max(max));

export const SuggestionSchema = z.object({
  parentNodeId: V2NodeIdSchema,
  title: submittedText(5, 100),
  description: submittedText(10, 1000),
}).strict();

const EditableNodeDataSchema = z.object({
  title: submittedText(2, 150),
  description: submittedText(10, 4000),
  aliases: z.array(submittedText(1, 150)).max(25),
}).strict();

export const EditSubmissionSchema = z.object({
  targetNodeId: V2NodeIdSchema,
  proposedData: EditableNodeDataSchema,
}).strict();
