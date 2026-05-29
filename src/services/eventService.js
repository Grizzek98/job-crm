import { supabase } from "../supabaseClient";

const EVENT_SELECT =
  "*, applications(id, status, positions(name, companies(name)))";

export async function getEvents() {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .order("date", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getEventsByApplication(applicationId) {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("application_id", applicationId)
    .order("date", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createEvent(event) {
  const { data, error } = await supabase
    .from("events")
    .insert([event])
    .select(EVENT_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function updateEvent(id, updates) {
  const { data, error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", id)
    .select(EVENT_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEvent(id) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Silently creates an auto-event. On failure, logs to console and shows a
 * warning via the provided notify function (does not throw).
 */
export async function createAutoEvent(event, notify) {
  try {
    await supabase
      .from("events")
      .insert([{ date: new Date().toISOString(), ...event }]);
  } catch (err) {
    console.error("Auto-event failed:", err);
    if (notify) {
      notify("Saved, but the activity log entry failed.", "warning");
    }
  }
}
