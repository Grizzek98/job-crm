import { supabase } from "../supabaseClient";

// Returns YYYY-MM-DD in the user's local timezone
function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}

export async function getGoalsForDate(date) {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("date", date)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Persist a new drag-drop order. orderedIds = goal IDs in the desired order.
export async function reorderGoals(orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("goals").update({ sort_order: index }).eq("id", id)
    )
  );
}

export async function createGoal(goal) {
  const { data, error } = await supabase
    .from("goals")
    .insert([goal])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGoal(id, updates) {
  const { data, error } = await supabase
    .from("goals")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGoal(id) {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}

// Called on first Dashboard visit of the day.
// Returns null if auto goals already exist (no-op), or the newly inserted rows.
export async function generateGoalsForToday() {
  const today = todayStr();
  const { data: existing } = await supabase
    .from("goals")
    .select("id")
    .eq("date", today)
    .eq("is_auto", true);
  if (existing?.length > 0) return null;
  return _insertAutoGoals(today);
}

// Called by the ✨ Refresh button — wipes today's auto goals and regenerates.
export async function refreshAutoGoals() {
  const today = todayStr();
  await supabase.from("goals").delete().eq("date", today).eq("is_auto", true);
  return _insertAutoGoals(today);
}

async function _insertAutoGoals(today) {
  // Anti-repetition: labels used in the past 4 days won't be repeated
  const past4 = Array.from({ length: 4 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (i + 1));
    return d.toLocaleDateString("en-CA");
  });

  const { data: recent } = await supabase
    .from("goals")
    .select("label")
    .in("date", past4)
    .eq("is_auto", true);

  const recentLabels = new Set(recent?.map((g) => g.label) ?? []);

  // Data-aware: how many active/applying positions have no application yet
  const { data: posData } = await supabase
    .from("positions")
    .select("id, applications(id)")
    .in("status", ["active", "applying"]);
  const unapplied = (posData ?? []).filter(
    (p) => !p.applications || p.applications.length === 0
  ).length;

  // Pool grouped by family — only one goal per group will ever be picked,
  // so we'll never suggest e.g. "Apply to 2 jobs" AND "Apply to 3 jobs" together.
  const pool = [
    // group: apply — only offered when unapplied positions exist
    ...(unapplied >= 1 ? [{ group: "apply",    type: "number", label: "Apply to 1 job today",        target_value: 1   }] : []),
    ...(unapplied >= 2 ? [{ group: "apply",    type: "number", label: "Apply to 2 jobs today",       target_value: 2   }] : []),
    ...(unapplied >= 3 ? [{ group: "apply",    type: "number", label: "Apply to 3 jobs today",       target_value: 3   }] : []),
    // group: time
    { group: "time",     type: "time",   label: "Spend 30 minutes job hunting",   target_value: 30  },
    { group: "time",     type: "time",   label: "Spend 45 minutes job hunting",   target_value: 45  },
    { group: "time",     type: "time",   label: "Spend 60 minutes job hunting",   target_value: 60  },
    { group: "time",     type: "time",   label: "Spend 90 minutes job hunting",   target_value: 90  },
    { group: "time",     type: "time",   label: "Spend 2 hours job hunting",      target_value: 120 },
    // group: add_positions
    { group: "add",      type: "number", label: "Add 1 new position to track",    target_value: 1   },
    { group: "add",      type: "number", label: "Add 2 new positions to track",   target_value: 2   },
    { group: "add",      type: "number", label: "Add 3 new positions to track",   target_value: 3   },
    // group: pomodoros
    { group: "pomodoro", type: "number", label: "Complete 2 Pomodoros",           target_value: 2   },
    { group: "pomodoro", type: "number", label: "Complete 3 Pomodoros",           target_value: 3   },
    { group: "pomodoro", type: "number", label: "Complete 4 Pomodoros",           target_value: 4   },
  ];

  // 1. Remove labels seen in the past 4 days
  const eligible = pool.filter((g) => !recentLabels.has(g.label));

  // 2. Bucket by group, then pick ONE random candidate from each group.
  //    This prevents e.g. "Apply to 2 jobs" + "Apply to 3 jobs" appearing together.
  const byGroup = {};
  for (const g of eligible) {
    if (!byGroup[g.group]) byGroup[g.group] = [];
    byGroup[g.group].push(g);
  }
  const groupWinners = Object.values(byGroup).map(
    (members) => members[Math.floor(Math.random() * members.length)]
  );

  if (groupWinners.length === 0) return [];

  // 3. Shuffle the winners and take 2–3
  const shuffled = groupWinners.sort(() => Math.random() - 0.5);
  const picked   = shuffled.slice(0, Math.min(3, Math.max(2, shuffled.length)));

  const { data, error } = await supabase
    .from("goals")
    .insert(
      picked.map((g) => {
        const { group: _group, ...goal } = g; // strip internal-only field
        return { ...goal, date: today, is_auto: true, completed: false, current_value: 0 };
      })
    )
    .select();
  if (error) throw error;
  return data ?? [];
}
