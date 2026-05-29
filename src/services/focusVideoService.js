import { supabase } from "../supabaseClient";
import { extractYouTubeId } from "../utils/youtube";

// ── YouTube duration helpers ──────────────────────────────────────────────────

function parseDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const h = parseInt(match[1] ?? "0", 10);
  const m = parseInt(match[2] ?? "0", 10);
  const s = parseInt(match[3] ?? "0", 10);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function fetchYouTubeDuration(url) {
  try {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) return null;
    const videoId = extractYouTubeId(url);
    if (!videoId) return null;
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${apiKey}`
    );
    const data = await res.json();
    const iso = data.items?.[0]?.contentDetails?.duration;
    return iso ? parseDuration(iso) : null;
  } catch {
    return null;
  }
}

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
