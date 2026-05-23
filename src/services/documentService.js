import { supabase } from "../supabaseClient";
import { createAutoEvent } from "./eventService";

const BUCKET = "documents";

export async function getDocuments() {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("name");

  if (error) throw error;
  return data;
}

export async function uploadDocument(file) {
  const ext = file.name.split(".").pop();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file);

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return { path, publicUrl: urlData.publicUrl };
}

export async function deleteDocumentFile(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function createDocument(document, notify) {
  const { data, error } = await supabase
    .from("documents")
    .insert([document])
    .select()
    .single();

  if (error) throw error;

  await createAutoEvent(
    {
      type: "entity_created",
      notes: `Document '${data.name}' uploaded`,
      application_id: null,
    },
    notify,
  );

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
