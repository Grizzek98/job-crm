import { supabase } from "../supabaseClient";

/**
 * Returns positions in `active` or `applying` status with no linked application,
 * each tagged with an urgency tier: "stale" | "applying" | "unapplied"
 */
export async function getPositionsNeedingAttention(settings) {
  const staleDays = settings?.stale_days ?? 7;
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - staleDays);

  const { data, error } = await supabase
    .from("positions")
    .select("*, companies(name), applications(id)")
    .in("status", ["active", "applying"])
    .order("updated_at", { ascending: true });

  if (error) throw error;

  const staleTs = staleDate.getTime();

  const unapplied = (data ?? []).filter(
    (p) => !p.applications || p.applications.length === 0,
  );

  const TIER_ORDER = { stale: 0, applying: 1, unapplied: 2 };

  return unapplied
    .map((p) => {
      const isStale = new Date(p.updated_at).getTime() < staleTs;
      let tier;
      if (isStale) {
        tier = "stale";
      } else if (p.status === "applying") {
        tier = "applying";
      } else {
        tier = "unapplied";
      }
      return { ...p, tier };
    })
    .sort((a, b) => {
      if (TIER_ORDER[a.tier] !== TIER_ORDER[b.tier])
        return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
      return new Date(a.updated_at) - new Date(b.updated_at);
    });
}

/**
 * Returns applications in `applied` or `interviewing` status
 * with no activity for ghost_days days.
 */
export async function getStaleApplications(settings) {
  const ghostDays = settings?.ghost_days ?? 14;
  const ghostDate = new Date();
  ghostDate.setDate(ghostDate.getDate() - ghostDays);

  const { data, error } = await supabase
    .from("applications")
    .select("*, positions(name, companies(name))")
    .in("status", ["applied", "interviewing"])
    .lt("updated_at", ghostDate.toISOString())
    .order("updated_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getStats() {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  const [allApps, weekApps, interviews, offers] = await Promise.all([
    supabase.from("applications").select("id", { count: "exact", head: true }),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .gte("applied_date", weekAgoStr),
    // Cumulative: every application that has ever reached the interview stage,
    // regardless of its current status. See milestone timestamps in
    // applicationService — offered → rejected still counts here.
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .not("first_interview_at", "is", null),
    // Cumulative: every application that has ever received an offer.
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .not("first_offer_at", "is", null),
  ]);

  return {
    totalApplications: allApps.count ?? 0,
    appliedThisWeek: weekApps.count ?? 0,
    interviews: interviews.count ?? 0,
    offersReceived: offers.count ?? 0,
  };
}

export async function getSmartAlerts(settings) {
  const staleDays = settings?.stale_days ?? 7;
  const ghostDays = settings?.ghost_days ?? 14;
  const now = new Date();

  const staleDate = new Date(now);
  staleDate.setDate(staleDate.getDate() - staleDays);

  const ghostDate = new Date(now);
  ghostDate.setDate(ghostDate.getDate() - ghostDays);

  const rejectDate = new Date(now);
  rejectDate.setDate(rejectDate.getDate() - 7);

  const [stalePositions, ghostedApps, applyingNeedApp, recentRejections] =
    await Promise.all([
      // Positions marked active not updated in N days
      supabase
        .from("positions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .lt("updated_at", staleDate.toISOString()),

      // Applications with no update in N days, still active
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .in("status", ["applied", "interviewing"])
        .lt("updated_at", ghostDate.toISOString()),

      // Positions in 'applying' with no linked application
      supabase
        .from("positions")
        .select("id")
        .eq("status", "applying"),

      // Recent rejections
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "rejected")
        .gte("updated_at", rejectDate.toISOString()),
    ]);

  // For 'applying with no app', we need to check against applications table
  let applyingCount = 0;
  if (applyingNeedApp.data?.length) {
    const posIds = applyingNeedApp.data.map((p) => p.id);
    const { data: linked } = await supabase
      .from("applications")
      .select("position_id")
      .in("position_id", posIds);
    const linkedIds = new Set((linked ?? []).map((a) => a.position_id));
    applyingCount = posIds.filter((id) => !linkedIds.has(id)).length;
  }

  const alerts = [];

  if ((stalePositions.count ?? 0) > 0) {
    alerts.push({
      type: "stale",
      severity: "warning",
      message: `You have ${stalePositions.count} active position${stalePositions.count === 1 ? "" : "s"} you haven't touched in a while. Have you applied yet? 👀`,
      ctaLabel: "View Positions",
      ctaRoute: "/positions",
    });
  }

  if ((ghostedApps.count ?? 0) > 0) {
    alerts.push({
      type: "ghosted",
      severity: "info",
      message: `${ghostedApps.count} application${ghostedApps.count === 1 ? "" : "s"} might be going cold. Consider following up or marking as ghosted. 👻`,
      ctaLabel: "View CRM",
      ctaRoute: "/crm",
    });
  }

  if (applyingCount > 0) {
    alerts.push({
      type: "applying",
      severity: "warning",
      message: `${applyingCount} position${applyingCount === 1 ? " is" : "s are"} in 'Applying' status but don't have an application yet. Finish them! 💪`,
      ctaLabel: "View Positions",
      ctaRoute: "/positions",
    });
  }

  if ((recentRejections.count ?? 0) > 0) {
    alerts.push({
      type: "rejections",
      severity: "error",
      message: `You got ${recentRejections.count} rejection${recentRejections.count === 1 ? "" : "s"} this week. That means you're trying — keep going! You've got this 🔥`,
      ctaLabel: "View CRM",
      ctaRoute: "/crm",
    });
  }

  return alerts;
}
