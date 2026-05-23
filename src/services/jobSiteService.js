import { supabase } from "../supabaseClient";

export async function getJobSites() {
  const { data, error } = await supabase
    .from("job_sites")
    .select("*")
    .order("is_preset", { ascending: false })
    .order("name");

  if (error) throw error;
  return data;
}

export async function createJobSite(site) {
  const { data, error } = await supabase
    .from("job_sites")
    .insert([{ ...site, is_preset: false }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJobSite(id, updates) {
  const { data, error } = await supabase
    .from("job_sites")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteJobSite(id) {
  const { error } = await supabase.from("job_sites").delete().eq("id", id);
  if (error) throw error;
}
