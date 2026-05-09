import { supabase } from "../supabaseClient";

export async function getPositions() {
  const { data, error } = await supabase
    .from("positions")
    .select("*, companies(name)")
    .order("name");

  if (error) throw error;
  return data;
}

export async function createPosition(position) {
  const { data, error } = await supabase
    .from("positions")
    .insert([position])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePosition(id, updates) {
  const { data, error } = await supabase
    .from("positions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePosition(id) {
  const { error } = await supabase.from("positions").delete().eq("id", id);

  if (error) throw error;
}
