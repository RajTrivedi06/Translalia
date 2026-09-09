/** Shape of the JSON returned by the admin_overview() RPC. */
export interface AdminOverview {
  generated_at: string;
  poems_finished: number;
  poems_in_progress: number;
  lines_saved: number;
  lines_undated: number;
  source_languages: number;
  target_languages: number;
  finished_with_pair: number;
  pairings: number;
  translators: number;
  active_30d: number;
  reflections_written: number;
  hand: { manual: number; classified: number } | null;
  growth: Array<{ week: string; lines: number }>;
  languages: Array<{
    source: string;
    target: string | null;
    poems_finished: number;
    poems_started: number;
  }>;
  funnel: {
    started: number;
    ran: number;
    saved_first_line: number;
    finished: number;
    reflected: number;
  };
  recent_translators: Array<{
    name: string;
    last_active: string;
    poems_finished: number;
  }>;
}
