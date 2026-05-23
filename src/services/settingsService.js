import { supabase } from "../supabaseClient";

const DEFAULTS = {
  daily_goal: 2,
  stale_days: 7,
  ghost_days: 14,
  visible_event_types: [
    "interview",
    "offer",
    "rejection",
    "follow_up",
    "chat",
    "other",
    "entity_created",
    "discovered",
    "status_change",
  ],
  google_calendar_token: null,
  pomodoro_work_min: 25,
  pomodoro_break_min: 5,
  session_tracker_enabled: true,
  session_tracker_interval_min: 30,
  theme_primary: "#1976d2",
  theme_secondary: "#9c27b0",
};

export async function getSettings() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Try to fetch existing settings row first
  const { data: existing } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return existing;

  // No row yet — create one with defaults
  const { data, error } = await supabase
    .from("settings")
    .insert({ user_id: user.id, ...DEFAULTS })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function upsertSettings(updates) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("settings")
    .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}
