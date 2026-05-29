import { supabase } from "../supabaseClient";
import { createAutoEvent } from "./eventService";

export async function getContacts() {
  const { data, error } = await supabase
    .from("contacts")
    .select("*, companies(name)")
    .order("name");

  if (error) throw error;
  return data;
}

export async function createContact(contact, notify) {
  const { data, error } = await supabase
    .from("contacts")
    .insert([contact])
    .select("*, companies(name)")
    .single();

  if (error) throw error;

  const companyName = data.companies?.name ?? "unknown company";
  await createAutoEvent(
    {
      type: "entity_created",
      notes: `Contact '${data.name}' added at ${companyName}`,
      application_id: null,
    },
    notify,
  );

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
