import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  from: vi.fn(),
  getNodeById: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ from: mocks.from }),
}));

vi.mock("@/lib/v2/data", () => ({
  v2Graph: { getNodeById: mocks.getNodeById },
}));

import { POST } from "../route";

const originalData = {
  title: "BCA",
  description: "Computing degree",
  aliases: ["Bachelor of Computer Applications"],
};

const proposedData = {
  title: "Bachelor of Computer Applications",
  description: "An undergraduate computing degree.",
  aliases: ["BCA"],
};

function request(body: unknown = {
  targetNodeId: "degree:bca",
  proposedData,
}): Request {
  return new Request("http://localhost/api/edit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/edit", () => {
  beforeEach(() => {
    mocks.checkRateLimit.mockReturnValue(true);
    mocks.getNodeById.mockReturnValue({ id: "degree:bca", ...originalData });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ insert: mocks.insert });
  });

  it("stores a valid edit with original data from the trusted graph", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.from).toHaveBeenCalledWith("edits");
    expect(mocks.insert).toHaveBeenCalledWith({
      target_node_id: "degree:bca",
      original_data: originalData,
      proposed_data: proposedData,
      status: "pending_review",
    });
  });

  it("rejects an unknown target ID", async () => {
    mocks.getNodeById.mockReturnValue(undefined);

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects an unchanged payload", async () => {
    const response = await POST(request({
      targetNodeId: "degree:bca",
      proposedData: originalData,
    }));

    expect(response.status).toBe(409);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(new Request("http://localhost/api/edit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }));

    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("enforces rate limiting", async () => {
    mocks.checkRateLimit.mockReturnValue(false);

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns 500 when the database insert fails", async () => {
    mocks.insert.mockResolvedValue({ error: new Error("database unavailable") });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(request());

    expect(response.status).toBe(500);
  });
});
