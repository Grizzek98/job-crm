import { supabase } from "../supabaseClient";

export async function getDocuments() {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("name");

  if (error) throw error;
  return data;
}

export async function createDocument(document) {
  const { data, error } = await supabase
    .from("documents")
    .insert([document])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDocument(id, updates) {
  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDocument(id) {
  const { error } = await supabase.from("documents").delete().eq("id", id);

  if (error) throw error;
}
