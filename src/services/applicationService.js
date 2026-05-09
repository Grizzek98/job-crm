import { supabase } from "../supabaseClient";

export async function getApplications() {
  const { data, error } = await supabase
    .from("applications")
    .select("*, positions(name, companies(name))")
    .order("applied_date", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createApplication(application) {
  const { data, error } = await supabase
    .from("applications")
    .insert([application])
    .select("*, positions(name, companies(name))")
    .single();

  if (error) throw error;
  return data;
}

export async function updateApplication(id, updates) {
  const { data, error } = await supabase
    .from("applications")
    .update(updates)
    .eq("id", id)
    .select("*, positions(name, companies(name))")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteApplication(id) {
  const { error } = await supabase.from("applications").delete().eq("id", id);

  if (error) throw error;
}
