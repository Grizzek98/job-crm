import { supabase } from "../supabaseClient";

/**
 * Search companies, positions, and contacts by name (case-insensitive substring).
 * Returns up to 4 results per entity type. Silent on error — search is best-effort.
 */
export async function globalSearch(query) {
  const q = `%${query.trim()}%`;

  const [{ data: companies }, { data: positions }, { data: contacts }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name")
      .ilike("name", q)
      .limit(4),
    supabase
      .from("positions")
      .select("id, name, companies(name)")
      .ilike("name", q)
      .limit(4),
    supabase
      .from("contacts")
      .select("id, name, title, companies(name)")
      .ilike("name", q)
      .limit(4),
  ]);

  return {
    companies: companies ?? [],
    positions: positions ?? [],
    contacts: contacts ?? [],
  };
}
