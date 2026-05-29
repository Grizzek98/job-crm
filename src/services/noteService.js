import { supabase } from "../supabaseClient";

export async function getNotes() {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createNote(note) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("notes")
    .insert({ ...note, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(id, updates) {
  const { data, error } = await supabase
    .from("notes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(id) {
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
