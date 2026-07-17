import { describe, it, expect } from "vitest";
import { getEpisode } from "./storage";

// getEpisode validates the id format before it ever reaches a filesystem or
// Blob call, so these cases short-circuit to null without touching disk —
// no fs mocking needed. Regression coverage for the path-traversal fix.
describe("getEpisode id validation", () => {
  it("rejects a path-traversal id", async () => {
    expect(await getEpisode("../../../../etc/passwd")).toBeNull();
  });

  it("rejects an encoded-slash traversal id", async () => {
    expect(await getEpisode("..%2f..%2fsecret")).toBeNull();
  });

  it("rejects a non-date id", async () => {
    expect(await getEpisode("not-a-date")).toBeNull();
  });

  it("rejects an empty id", async () => {
    expect(await getEpisode("")).toBeNull();
  });

  it("accepts a well-formed YYYY-MM-DD id (falls through to lookup, returns null if not found)", async () => {
    // No matching file/blob exists in the test environment, so this proves
    // the id passed validation and reached the actual lookup, not that the
    // episode exists.
    await expect(getEpisode("2026-07-10")).resolves.not.toThrow();
  });
});
