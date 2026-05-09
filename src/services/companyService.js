import { supabase } from "../supabaseClient";

export async function getCompanies() {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("name");

  if (error) throw error;
  return data;
}

export async function createCompany(company) {
  const { data, error } = await supabase
    .from("companies")
    .insert([company])
    .select()
    .single();

  if (error) throw error;
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
