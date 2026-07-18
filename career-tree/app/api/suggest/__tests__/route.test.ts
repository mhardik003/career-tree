import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  from: vi.fn(),
  getNodeById: vi.fn(),
  hasChildTitle: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ from: mocks.from }),
}));

vi.mock("@/lib/v2/data", () => ({
  v2Graph: {
    getNodeById: mocks.getNodeById,
    hasChildTitle: mocks.hasChildTitle,
  },
}));

import { POST } from "../route";

const validBody = {
  parentNodeId: "degree:bca",
  title: "Cloud Engineering Certification",
  description: "A focused certification route for cloud infrastructure.",
};

function request(body: unknown = validBody): Request {
  return new Request("http://localhost/api/suggest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/suggest", () => {
  beforeEach(() => {
    mocks.checkRateLimit.mockReturnValue(true);
    mocks.getNodeById.mockReturnValue({ id: "degree:bca" });
    mocks.hasChildTitle.mockReturnValue(false);
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ insert: mocks.insert });
  });

  it("stores a valid suggestion by stable parent ID", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.from).toHaveBeenCalledWith("suggestions");
    expect(mocks.insert).toHaveBeenCalledWith({
      parent_node_id: "degree:bca",
      suggested_name: "Cloud Engineering Certification",
      suggested_description: "A focused certification route for cloud infrastructure.",
      status: "pending_review",
    });
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(new Request("http://localhost/api/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }));

    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects an unknown parent ID", async () => {
    mocks.getNodeById.mockReturnValue(undefined);

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects an existing child title", async () => {
    mocks.hasChildTitle.mockReturnValue(true);

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects a V1 path", async () => {
    const response = await POST(request({
      ...validBody,
      parentNodeId: "10th Class/Science/BCA",
    }));

    expect(response.status).toBe(400);
    expect(mocks.getNodeById).not.toHaveBeenCalled();
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
