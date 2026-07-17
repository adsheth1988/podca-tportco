import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { notifyFailure } from "./alerts";

describe("notifyFailure", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("no-ops without calling fetch when GITHUB_TOKEN is unset", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    await notifyFailure({ episodeId: "ep-1", message: "boom" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips creating an issue when an open matching issue already exists", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ title: "Episode generation failed — ep-1" }],
    });

    await notifyFailure({ episodeId: "ep-1", message: "boom" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/issues?state=open&labels=pipeline-failure");
    expect(options?.method).toBeUndefined(); // GET request, no method override
  });

  it("POSTs a new issue with the correct body and labels when no match exists", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // GET: no open issues
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // POST: created

    await notifyFailure({ episodeId: "ep-2", step: "tts", message: "synth failed" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [postUrl, postOptions] = fetchMock.mock.calls[1];
    expect(postUrl).toContain("/issues");
    expect(postOptions.method).toBe("POST");

    const body = JSON.parse(postOptions.body);
    expect(body.title).toBe("Episode generation failed — ep-2");
    expect(body.labels).toEqual(["pipeline-failure"]);
    expect(body.body).toContain("**Episode:** ep-2");
    expect(body.body).toContain("**Step:** tts");
    expect(body.body).toContain("synth failed");
  });

  it("omits the Step line when no step is provided", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await notifyFailure({ episodeId: "ep-3", message: "boom" });

    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.body).not.toContain("**Step:**");
  });

  it("never throws even when fetch itself rejects", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(
      notifyFailure({ episodeId: "ep-4", message: "boom" })
    ).resolves.toBeUndefined();
  });

  it("never throws when the GET issues call itself is not ok (treated as no open issue)", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    fetchMock
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await expect(
      notifyFailure({ episodeId: "ep-5", message: "boom" })
    ).resolves.toBeUndefined();
    // hasOpenIssue returns false on a non-ok GET, so it proceeds to POST
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses GITHUB_REPOSITORY when set, falling back to the hardcoded repo otherwise", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubEnv("GITHUB_REPOSITORY", "some-org/some-repo");
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await notifyFailure({ episodeId: "ep-6", message: "boom" });

    const [getUrl] = fetchMock.mock.calls[0];
    expect(getUrl).toContain("some-org/some-repo");
  });
});
