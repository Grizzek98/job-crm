import { supabase } from "../supabaseClient";
import { createAutoEvent } from "./eventService";

const APP_SELECT =
  "*, positions(name, pay_min, pay_max, pay_type, location, companies(name)), resume:documents!resume_id(id, name), cover_letter:documents!cover_letter_id(id, name)";

// Milestone timestamps are set the FIRST time an application reaches a stage and
// are never cleared — they let the dashboard report cumulative "ever reached X"
// counts even after the status moves on (e.g. offered → rejected still counts as
// an offer received). `applied_date` is the original example of this pattern.
// A status implies a milestone if reaching it means that stage must have happened:
//  - an offer doesn't require an interview (direct offers exist), so only an
//    explicit `interviewing` sets first_interview_at
//  - accepted/declined both require an offer to have existed
//  - any employer engagement (interview invite, offer, or rejection) is a response;
//    withdrawn (user-initiated) and ghosted (no reply) are not
const MILESTONE_TRIGGERS = {
  first_interview_at: ["interviewing"],
  first_offer_at: ["offered", "accepted", "declined"],
  first_response_at: ["interviewing", "offered", "accepted", "declined", "rejected"],
};

// Returns the milestone columns to set for `newStatus`, skipping any already set
// in `existing` so each milestone is written at most once.
function milestoneUpdates(newStatus, existing = {}) {
  const nowIso = new Date().toISOString();
  const updates = {};
  for (const [col, statuses] of Object.entries(MILESTONE_TRIGGERS)) {
    if (statuses.includes(newStatus) && !existing[col]) {
      updates[col] = nowIso;
    }
  }
  return updates;
}

export async function getApplications() {
  const { data, error } = await supabase
    .from("applications")
    .select(APP_SELECT)
    .order("applied_date", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createApplication(application, notify = () => {}) {
  // Applications can be created directly in a later status (e.g. "offered"),
  // so seed any milestones the initial status already implies.
  const payload = { ...application, ...milestoneUpdates(application.status) };
  const { data, error } = await supabase
    .from("applications")
    .insert([payload])
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
  let finalUpdates = updates;

  // On a status change, set any newly-reached milestones (set-once). Fetch the
  // existing milestone values first so we never overwrite an earlier timestamp.
  if (updates.status) {
    const { data: existing } = await supabase
      .from("applications")
      .select("first_interview_at, first_offer_at, first_response_at")
      .eq("id", id)
      .single();
    finalUpdates = { ...updates, ...milestoneUpdates(updates.status, existing ?? {}) };
  }

  const { data, error } = await supabase
    .from("applications")
    .update(finalUpdates)
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
