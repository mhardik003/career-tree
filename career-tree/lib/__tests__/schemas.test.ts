import { describe, expect, it } from "vitest";
import { EditSubmissionSchema, SuggestionSchema } from "../schemas";

describe("V2 submission schemas", () => {
  it("accepts stable node IDs and rejects V1 paths", () => {
    expect(SuggestionSchema.safeParse({
      parentNodeId: "degree:bca",
      title: "Cloud Engineering Certification",
      description: "A focused certification route for cloud infrastructure.",
    }).success).toBe(true);
    expect(SuggestionSchema.safeParse({
      parentNodeId: "10th Class/Science/BCA",
      title: "Cloud Engineering Certification",
      description: "A focused certification route for cloud infrastructure.",
    }).success).toBe(false);
  });

  it("allows only editable V2 node fields", () => {
    const parsed = EditSubmissionSchema.parse({
      targetNodeId: "degree:bca",
      proposedData: {
        title: "Bachelor of Computer Applications",
        description: "An undergraduate computing degree.",
        aliases: ["BCA"],
      },
    });
    expect(parsed.targetNodeId).toBe("degree:bca");
    expect(() => EditSubmissionSchema.parse({
      targetNodeId: "degree:bca",
      proposedData: {
        title: "BCA",
        description: "Valid description",
        aliases: [],
        difficulty_rating: 9,
      },
    })).toThrow();
  });
});
