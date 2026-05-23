import { supabase } from "../supabaseClient";
import { createAutoEvent } from "./eventService";

const APP_SELECT =
  "*, positions(name, pay_min, pay_max, pay_type, location, companies(name)), resume:documents!resume_id(id, name), cover_letter:documents!cover_letter_id(id, name)";

export async function getApplications() {
  const { data, error } = await supabase
    .from("applications")
    .select(APP_SELECT)
    .order("applied_date", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createApplication(application, notify = () => {}) {
  const { data, error } = await supabase
    .from("applications")
    .insert([application])
    .select(APP_SELECT)
    .single();

  if (error) throw error;

  // Auto-set the linked position's status to 'applied'
  if (data.position_id) {
    try {
      const { data: pos } = await supabase
        .from("positions")
        .select("status, name")
        .eq("id", data.position_id)
        .single();

      if (pos && pos.status !== "applied") {
        await supabase
          .from("positions")
          .update({ status: "applied" })
          .eq("id", data.position_id);

        await createAutoEvent(
          {
            type: "status_change",
            notes: `Position '${pos.name}' status: ${pos.status} → applied`,
            application_id: data.id,
          },
          notify,
        );
      }
    } catch (err) {
      console.error("Failed to auto-set position status to applied:", err);
      notify("Application saved, but couldn't update position status automatically.", "warning");
    }
  }

  return data;
}

export async function updateApplication(id, updates, notify, oldStatus) {
  const { data, error } = await supabase
    .from("applications")
    .update(updates)
    .eq("id", id)
    .select(APP_SELECT)
    .single();

  if (error) throw error;

  if (oldStatus && updates.status && oldStatus !== updates.status) {
    const positionName = data.positions?.name ?? "unknown position";
    await createAutoEvent(
      {
        type: "status_change",
        notes: `Application for '${positionName}' status: ${oldStatus} → ${updates.status}`,
        application_id: id,
      },
      notify,
    );
  }

  return data;
}

export async function deleteApplication(id) {
  const { error } = await supabase.from("applications").delete().eq("id", id);
  if (error) throw error;
}
