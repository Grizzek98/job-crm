import { supabase } from "../supabaseClient";

export async function getFocusVideos() {
  const { data, error } = await supabase
    .from("focus_videos")
    .select("*")
    .order("is_favorite", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createFocusVideo(video) {
  const { data, error } = await supabase
    .from("focus_videos")
    .insert([video])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFocusVideo(id, updates) {
  const { data, error } = await supabase
    .from("focus_videos")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFocusVideo(id) {
  const { error } = await supabase.from("focus_videos").delete().eq("id", id);
  if (error) throw error;
}
