// Failure alerting for the episode generation pipeline.
// Opens a GitHub issue when a run fails so a human finds out without
// having to notice a missing episode or dig through Action logs.
//
// Requires a GITHUB_TOKEN with `issues: write` on the target repo.
// In GitHub Actions this is the built-in token (workflow needs the
// `issues: write` permission granted). For the Vercel-triggered API
// route, set a personal access token as GITHUB_TOKEN in the deployment
// environment to enable this — it's a no-op (logs a warning) if unset.

const FAILURE_LABEL = "pipeline-failure";

interface FailureContext {
  episodeId: string;
  step?: string;
  message: string;
}

function getRepo(): string {
  return process.env.GITHUB_REPOSITORY ?? "adsheth1988/podca-tportco";
}

async function hasOpenIssue(repo: string, token: string, episodeId: string): Promise<boolean> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=open&labels=${FAILURE_LABEL}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) return false;
  const issues: Array<{ title: string }> = await res.json();
  return issues.some((issue) => issue.title.includes(episodeId));
}

// Best-effort — never throws, so a broken alert path can't take down
// the pipeline it's supposed to be reporting on.
export async function notifyFailure(ctx: FailureContext): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn("[alerts] GITHUB_TOKEN not set — skipping failure notification.");
    return;
  }

  const repo = getRepo();

  try {
    if (await hasOpenIssue(repo, token, ctx.episodeId)) {
      console.log(`[alerts] Open failure issue already exists for ${ctx.episodeId} — skipping.`);
      return;
    }

    const title = `Episode generation failed — ${ctx.episodeId}`;
    const body = [
      `**Episode:** ${ctx.episodeId}`,
      ctx.step ? `**Step:** ${ctx.step}` : null,
      `**Time:** ${new Date().toISOString()}`,
      "",
      "**Error:**",
      "```",
      ctx.message,
      "```",
    ].filter((line): line is string => line !== null).join("\n");

    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body, labels: [FAILURE_LABEL] }),
    });

    if (!res.ok) {
      console.error(`[alerts] Failed to create GitHub issue: ${res.status} ${await res.text()}`);
      return;
    }

    console.log(`[alerts] Opened failure issue for ${ctx.episodeId}`);
  } catch (err) {
    console.error("[alerts] notifyFailure threw:", err);
  }
}
