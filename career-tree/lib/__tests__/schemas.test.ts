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

// Regression: a NUL byte and an unpaired UTF-16 surrogate both pass every shape
// check Zod can make, but neither survives the write path — Postgres `text`
// cannot hold U+0000 (SQLSTATE 22P05) and an unpaired surrogate is not valid
// UTF-8, so PostgREST rejects the whole request body (PGRST102). Both used to
// reach the database and come back as a 500 "Something went wrong. Please try
// again later." on a submission the contributor had no way to correct, because
// both are invisible in the UI. They are stripped before the length checks now.
describe("unstorable character handling", () => {
  const NUL = String.fromCharCode(0);
  const HIGH_SURROGATE = String.fromCharCode(0xd800);
  const LOW_SURROGATE = String.fromCharCode(0xdc00);

  it("strips a NUL byte from a suggestion", () => {
    const parsed = SuggestionSchema.parse({
      parentNodeId: "degree:bca",
      title: `Cloud${NUL} Engineering`,
      description: `A focused${NUL} certification route for cloud infrastructure.`,
    });

    expect(parsed.title).toBe("Cloud Engineering");
    expect(parsed.description).toBe("A focused certification route for cloud infrastructure.");
  });

  it("strips unpaired surrogates from a suggestion", () => {
    const parsed = SuggestionSchema.parse({
      parentNodeId: "degree:bca",
      title: `Cloud${HIGH_SURROGATE} Engineering`,
      description: `A focused${LOW_SURROGATE} certification route for cloud infrastructure.`,
    });

    expect(parsed.title).toBe("Cloud Engineering");
    expect(parsed.title.isWellFormed()).toBe(true);
    expect(parsed.description.isWellFormed()).toBe(true);
  });

  it("keeps emoji, curly quotes and Devanagari intact", () => {
    const title = "Data Science 🚀";
    const description = "Bachelor’s — कक्षा 10 ke baad ka ek valid raasta hai.";
    const parsed = SuggestionSchema.parse({
      parentNodeId: "degree:bca",
      title,
      description,
    });

    expect(parsed.title).toBe(title);
    expect(parsed.description).toBe(description);
  });

  it("fails the length check when nothing storable remains", () => {
    const result = SuggestionSchema.safeParse({
      parentNodeId: "degree:bca",
      title: NUL.repeat(8),
      description: "A focused certification route for cloud infrastructure.",
    });

    expect(result.success).toBe(false);
  });

  it("strips unstorable characters from edit titles, descriptions and aliases", () => {
    const parsed = EditSubmissionSchema.parse({
      targetNodeId: "degree:bca",
      proposedData: {
        title: `Bachelor of${NUL} Computer Applications`,
        description: `An undergraduate${HIGH_SURROGATE} computing degree.`,
        aliases: [`BC${NUL}A`, `B.C.A${LOW_SURROGATE}.`],
      },
    });

    expect(parsed.proposedData.title).toBe("Bachelor of Computer Applications");
    expect(parsed.proposedData.description).toBe("An undergraduate computing degree.");
    expect(parsed.proposedData.aliases).toEqual(["BCA", "B.C.A."]);
  });
});
