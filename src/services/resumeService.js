import { supabase } from "../supabaseClient";
import { sampleResumeContent } from "../utils/resumeTemplate";

const UNIQUE_VIOLATION = "23505";

async function fetchMasterResume() {
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("is_master", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Returns the signed-in user's master resume, creating one filled with
 * made-up sample content the first time.
 */
export async function getOrCreateMasterResume() {
  const existing = await fetchMasterResume();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("resumes")
    .insert({ name: "Master resume", is_master: true, content: sampleResumeContent() })
    .select()
    .single();

  // Two loads at once (e.g. React StrictMode in dev) can both try to create it;
  // the unique index lets one win, and the other reads the winner's row.
  if (error?.code === UNIQUE_VIOLATION) return fetchMasterResume();
  if (error) throw error;
  return data;
}

// ── Tailored resumes (a copy of the master for one job) ──────────────────────

const LIST_COLUMNS = "id, name, is_master, position_id, updated_at";

/** Every resume of the signed-in user: master first, then tailored copies by name. */
export async function listResumes() {
  const { data, error } = await supabase
    .from("resumes")
    .select(LIST_COLUMNS)
    .order("is_master", { ascending: false })
    .order("name");
  if (error) throw error;
  return data;
}

export async function getResume(id) {
  const { data, error } = await supabase.from("resumes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That resume doesn't exist anymore.");
  return data;
}

async function fetchResumeForPosition(positionId) {
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("position_id", positionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Returns the tailored resume for a job, first making one by copying the
 * master resume if the job doesn't have one yet.
 */
export async function getOrCreateTailoredResume(positionId) {
  const existing = await fetchResumeForPosition(positionId);
  if (existing) return existing;

  const [master, { data: position, error: positionError }] = await Promise.all([
    getOrCreateMasterResume(),
    supabase.from("positions").select("name, companies(name)").eq("id", positionId).single(),
  ]);
  if (positionError) throw positionError;

  const name = [position.name, position.companies?.name].filter(Boolean).join(" – ") || "Tailored resume";
  const { data, error } = await supabase
    .from("resumes")
    .insert({ name, is_master: false, position_id: positionId, content: master.content })
    .select()
    .single();

  // Opened twice at once: the one-per-job index lets one win; use that one.
  if (error?.code === UNIQUE_VIOLATION) return fetchResumeForPosition(positionId);
  if (error) throw error;
  return data;
}

export async function deleteResume(id) {
  const { error } = await supabase.from("resumes").delete().eq("id", id).eq("is_master", false);
  if (error) throw error;
}

/** The job a tailored resume is for, with what the job listing panel shows. */
export async function getPositionForResume(positionId) {
  const { data, error } = await supabase
    .from("positions")
    .select("id, name, description, requirements, url_listing, companies(name)")
    .eq("id", positionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateResumeContent(id, content) {
  const { data, error } = await supabase
    .from("resumes")
    .update({ content })
    .eq("id", id)
    .select("id, updated_at")
    .single();
  if (error) throw error;
  return data;
}
