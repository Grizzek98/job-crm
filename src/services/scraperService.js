import { supabase } from "../supabaseClient";

/**
 * Calls the scrape-job Edge Function with a job listing URL.
 * Returns a flat object with company_ and position fields, or throws.
 */
export async function scrapeJob(url) {
  const { data, error } = await supabase.functions.invoke("scrape-job", {
    body: { url },
  });

  if (error) throw error;
  if (!data) throw new Error("Scraper returned no data.");

  return data;
}

/**
 * Calls the scrape-job Edge Function with raw pasted job description text.
 * Returns a flat object with company_ and position fields, or throws.
 */
export async function parseJobText(text) {
  const { data, error } = await supabase.functions.invoke("scrape-job", {
    body: { text },
  });

  if (error) throw error;
  if (!data) throw new Error("Parser returned no data.");

  return data;
}
