/**
 * Google Calendar REST API v3 — read-only.
 * Fetches events and calendar list using a GIS access token.
 */

const API_BASE = "https://www.googleapis.com/calendar/v3";

// ─── Helper ───────────────────────────────────────────────────────────────────

async function gcalFetch(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.error?.message ?? `Google Calendar API error ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

// ─── Calendar list ────────────────────────────────────────────────────────────

/**
 * Returns the user's list of calendars.
 * @param {string} token  GIS access token
 * @returns {Promise<Array<{ id, label, primary, color }>>}
 */
export async function fetchCalendarList(token) {
  const data = await gcalFetch(
    `${API_BASE}/users/me/calendarList?maxResults=50`,
    token,
  );
  return (data.items ?? []).map((item) => ({
    id:      item.id,
    label:   item.summary ?? item.id,
    primary: item.primary ?? false,
    color:   item.backgroundColor ?? null,
  }));
}

// ─── Events ───────────────────────────────────────────────────────────────────

/**
 * Fetch calendar events within a date range from a specific calendar.
 *
 * @param {string} token   GIS access token
 * @param {{ timeMin: string, timeMax: string, calendarId?: string }} opts
 * @returns {Promise<Array>}  Normalized event objects
 */
export async function fetchCalendarEvents(token, { timeMin, timeMax, calendarId = "primary" }) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy:      "startTime",
    maxResults:   "250",
  });

  const encodedId = encodeURIComponent(calendarId);
  const data = await gcalFetch(
    `${API_BASE}/calendars/${encodedId}/events?${params}`,
    token,
  );

  return (data.items ?? []).map((item) => ({
    id:          `gcal-${item.id}`,
    source:      "google",
    type:        "google_calendar",
    calendarId,
    title:       item.summary ?? "(No title)",
    // dateTime = timed event; date = all-day event
    date:        item.start?.dateTime ?? item.start?.date ?? null,
    allDay:      !item.start?.dateTime,
    description: item.description ?? null,
    htmlLink:    item.htmlLink ?? null,
  }));
}

/**
 * Fetch events from multiple calendars and deduplicate by id.
 * @param {string}   token
 * @param {string[]} calendarIds
 * @param {{ timeMin: string, timeMax: string }} range
 * @returns {Promise<Array>}
 */
export async function fetchCalendarEventsMulti(token, calendarIds, { timeMin, timeMax }) {
  if (!calendarIds.length) return [];
  const results = await Promise.all(
    calendarIds.map((id) => fetchCalendarEvents(token, { timeMin, timeMax, calendarId: id })),
  );
  const seen = new Set();
  return results.flat().filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}
