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
