import { supabase } from "../supabaseClient";
import { createAutoEvent } from "./eventService";

export async function getCompanies() {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("name");

  if (error) throw error;
  return data;
}

export async function createCompany(company, notify) {
  const { data, error } = await supabase
    .from("companies")
    .insert([company])
    .select()
    .single();

  if (error) throw error;

  await createAutoEvent(
    { type: "entity_created", notes: `Company '${data.name}' added`, application_id: null },
    notify,
  );

  return data;
}

export async function updateCompany(id, updates) {
  const { data, error } = await supabase
    .from("companies")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCompany(id) {
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw error;
}
