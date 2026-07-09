import "server-only";
import { getPool } from "./client";

export interface PersonalEpisode {
  id: string;
  userId: string;
  date: string; // "YYYY-MM-DD"
  status: "pending" | "generating" | "ready" | "failed";
  script: string | null;
  audioUrl: string | null;
  durationSeconds: number | null;
  wordCount: number | null;
  articleCount: number | null;
  generatedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface Row {
  id: string;
  userId: string;
  date: string;
  status: PersonalEpisode["status"];
  script: string | null;
  audio_url: string | null;
  duration_seconds: number | null;
  word_count: number | null;
  article_count: number | null;
  generated_at: string | null;
  error_message: string | null;
  created_at: string;
}

function fromRow(r: Row): PersonalEpisode {
  return {
    id: r.id,
    userId: r.userId,
    date: r.date,
    status: r.status,
    script: r.script,
    audioUrl: r.audio_url,
    durationSeconds: r.duration_seconds,
    wordCount: r.word_count,
    articleCount: r.article_count,
    generatedAt: r.generated_at,
    errorMessage: r.error_message,
    createdAt: r.created_at,
  };
}

export async function getPersonalEpisode(userId: string, date: string): Promise<PersonalEpisode | null> {
  const { rows } = await getPool().query<Row>(
    `SELECT id, "userId", date::text, status, script, audio_url, duration_seconds,
            word_count, article_count, generated_at, error_message, created_at
     FROM personal_episodes WHERE "userId" = $1 AND date = $2`,
    [userId, date]
  );
  return rows.length > 0 ? fromRow(rows[0]) : null;
}

export async function listPersonalEpisodes(userId: string): Promise<PersonalEpisode[]> {
  const { rows } = await getPool().query<Row>(
    `SELECT id, "userId", date::text, status, script, audio_url, duration_seconds,
            word_count, article_count, generated_at, error_message, created_at
     FROM personal_episodes WHERE "userId" = $1 ORDER BY date DESC`,
    [userId]
  );
  return rows.map(fromRow);
}

export async function savePersonalEpisode(
  userId: string,
  date: string,
  fields: Partial<Omit<PersonalEpisode, "id" | "userId" | "date" | "createdAt">>
): Promise<void> {
  await getPool().query(
    `INSERT INTO personal_episodes
       ("userId", date, status, script, audio_url, duration_seconds, word_count, article_count, generated_at, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT ("userId", date) DO UPDATE SET
       status = $3, script = $4, audio_url = $5, duration_seconds = $6,
       word_count = $7, article_count = $8, generated_at = $9, error_message = $10`,
    [
      userId,
      date,
      fields.status ?? "pending",
      fields.script ?? null,
      fields.audioUrl ?? null,
      fields.durationSeconds ?? null,
      fields.wordCount ?? null,
      fields.articleCount ?? null,
      fields.generatedAt ?? null,
      fields.errorMessage ?? null,
    ]
  );
}
