// Episode lifecycle status
export type EpisodeStatus = "pending" | "generating" | "ready" | "failed";

// A single chapter marker (also embedded in the MP3 as ID3 CHAP frames).
export interface EpisodeChapter {
  startMs:              number;           // start offset on the real audio timeline
  title:                string;
}

// Stored episode (Neon DB shape — comes in Slice 5)
export interface Episode {
  id:                   string;
  date:                 string;           // "YYYY-MM-DD" in EST
  status:               EpisodeStatus;
  script:               string | null;
  audioUrl:             string | null;    // Vercel Blob URL
  durationSeconds:      number | null;
  wordCount:            number | null;
  articleCount:         number | null;
  generatedAt:          string | null;    // ISO 8601
  errorMessage:         string | null;
  createdAt:            string;           // ISO 8601
  chapters?:            EpisodeChapter[]; // optional — timestamped chapter markers
}

// Returned by POST /api/generate during development (before Blob storage)
export interface GenerationResult {
  date:                     string;
  wordCount:                number;
  estimatedDurationSeconds: number;
  articleCount:             number;
  script:                   string;
  audioBase64:              string;  // base64 MP3 — use as data:audio/mpeg;base64,...
  elapsedMs:                number;
  errors:                   string[];
}
