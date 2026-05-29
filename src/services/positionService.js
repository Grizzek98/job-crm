import { supabase } from "../supabaseClient";
import { createAutoEvent } from "./eventService";

export async function getPositions() {
  const { data, error } = await supabase
    .from("positions")
    .select("*, companies(name)")
    .order("name");

  if (error) throw error;
  return data;
}

export async function createPosition(position, notify, isScraped = false) {
  const { data, error } = await supabase
    .from("positions")
    .insert([position])
    .select("*, companies(name)")
    .single();

  if (error) throw error;

  const companyName = data.companies?.name ?? "unknown company";
  const eventType = isScraped ? "discovered" : "entity_created";
  const notes = isScraped
    ? `Position '${data.name}' discovered at ${companyName}`
    : `Position '${data.name}' added at ${companyName}`;

  await createAutoEvent({ type: eventType, notes, application_id: null }, notify);

  return data;
}

export async function updatePosition(id, updates, notify, oldStatus) {
  const { data, error } = await supabase
    .from("positions")
    .update(updates)
    .eq("id", id)
    .select("*, companies(name)")
    .single();

  if (error) throw error;

  if (oldStatus && updates.status && oldStatus !== updates.status) {
    await createAutoEvent(
      {
        type: "status_change",
        notes: `Position '${data.name}' status: ${oldStatus} → ${updates.status}`,
        application_id: null,
      },
      notify,
    );
  }

  return data;
}

export async function deletePosition(id) {
  const { error } = await supabase.from("positions").delete().eq("id", id);
  if (error) throw error;
}
