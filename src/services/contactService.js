import { supabase } from "../supabaseClient";

export async function getContacts() {
  const { data, error } = await supabase
    .from("contacts")
    .select("*, companies(name)")
    .order("name");

  if (error) throw error;
  return data;
}

export async function createContact(contact) {
  const { data, error } = await supabase
    .from("contacts")
    .insert([contact])
    .select("*, companies(name)")
    .single();

  if (error) throw error;
  return data;
}

export async function updateContact(id, updates) {
  const { data, error } = await supabase
    .from("contacts")
    .update(updates)
    .eq("id", id)
    .select("*, companies(name)")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteContact(id) {
  const { error } = await supabase.from("contacts").delete().eq("id", id);

  if (error) throw error;
}
