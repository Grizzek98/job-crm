import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  FormGroup,
  IconButton,
  Popover,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { Calendar, dayjsLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ChevronLeftIcon   from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon  from "@mui/icons-material/ChevronRight";
import EventIcon         from "@mui/icons-material/Event";
import OpenInNewIcon     from "@mui/icons-material/OpenInNew";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import localeData      from "dayjs/plugin/localeData";
import relativeTime    from "dayjs/plugin/relativeTime";
import { getEvents }                                             from "../services/eventService";
import { getSettings, upsertSettings }                          from "../services/settingsService";
import { fetchCalendarList, fetchCalendarEventsMulti }          from "../services/calendarService";
import { getStoredToken, clearStoredToken, requestCalendarToken } from "../utils/googleAuth";
import { useNotify } from "../context/NotificationContext";

dayjs.extend(localizedFormat);
dayjs.extend(localeData);
dayjs.extend(relativeTime);

const localizer = dayjsLocalizer(dayjs);

// ── localStorage persistence for selected calendar IDs ─────────────────────
const GCAL_SELECTED_KEY = "gcal_selected_calendars";

function getSavedCalIds() {
  try {
    const raw = localStorage.getItem(GCAL_SELECTED_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCalIds(ids) {
  try { localStorage.setItem(GCAL_SELECTED_KEY, JSON.stringify(ids)); } catch {}
}

// ── Constants ───────────────────────────────────────────────────────────────

const EVENT_TYPE_META = {
  interview:      { label: "Interview",     color: "primary"   },
  offer:          { label: "Offer",         color: "success"   },
  rejection:      { label: "Rejection",     color: "error"     },
  follow_up:      { label: "Follow Up",     color: "warning"   },
  chat:           { label: "Chat",          color: "info"      },
  other:          { label: "Other",         color: "default"   },
  entity_created: { label: "Created",       color: "default"   },
  discovered:     { label: "Discovered",    color: "secondary" },
  status_change:  { label: "Status Change", color: "info"      },
};

// Maps event type → MUI palette key for calendar color coding
const TYPE_PALETTE_KEY = {
  interview:      "primary",
  offer:          "success",
  rejection:      "error",
  follow_up:      "warning",
  chat:           "info",
  status_change:  "info",
  discovered:     "secondary",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function eventLabel(ev) {
  const pos = ev.applications?.positions;
  if (!pos) return ev.notes ?? "—";
  return `${pos.name} @ ${pos.companies?.name ?? ""}`;
}

function calEventTitle(ev) {
  if (ev.source === "google") return ev.title;
  const pos = ev.applications?.positions;
  const typeLabel = EVENT_TYPE_META[ev.type]?.label ?? ev.type;
  if (pos) return `${typeLabel}: ${pos.name}`;
  if (ev.notes) return ev.notes.length > 40 ? ev.notes.slice(0, 40) + "…" : ev.notes;
  return typeLabel;
}

function toRbcEvent(ev) {
  const start = new Date(ev.date);
  const end   = ev.allDay
    ? new Date(dayjs(ev.date).add(1, "day").valueOf())
    : start;
  return {
    id:       ev.id,
    title:    calEventTitle(ev),
    start,
    end,
    allDay:   ev.allDay ?? false,
    resource: ev,
  };
}

// ── Custom toolbar (defined outside component for stable ref) ────────────────

function CustomToolbar({ date, view, onNavigate, onView }) {
  const label =
    view === Views.WEEK
      ? `${dayjs(date).startOf("week").format("MMM D")} – ${dayjs(date).endOf("week").format("MMM D, YYYY")}`
      : view === Views.AGENDA
      ? `${dayjs(date).format("MMM D")} – ${dayjs(date).add(30, "day").format("MMM D, YYYY")}`
      : dayjs(date).format("MMMM YYYY");

  return (
    <Box
      sx={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        mb: 2,
        flexWrap: "wrap",
        gap: 1,
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <Tooltip title="Previous">
          <IconButton size="small" onClick={() => onNavigate("PREV")}>
            <ChevronLeftIcon />
          </IconButton>
        </Tooltip>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onNavigate("TODAY")}
          sx={{ minWidth: 64, fontWeight: 600 }}
        >
          Today
        </Button>
        <Tooltip title="Next">
          <IconButton size="small" onClick={() => onNavigate("NEXT")}>
            <ChevronRightIcon />
          </IconButton>
        </Tooltip>
        <Typography variant="h6" fontWeight="bold" sx={{ ml: 1 }}>
          {label}
        </Typography>
      </Stack>

      <ToggleButtonGroup
        value={view}
        exclusive
        onChange={(_, v) => v && onView(v)}
        size="small"
      >
        <ToggleButton value={Views.MONTH}>Month</ToggleButton>
        <ToggleButton value={Views.WEEK}>Week</ToggleButton>
        <ToggleButton value={Views.AGENDA}>Agenda</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

const RBC_COMPONENTS = { toolbar: CustomToolbar };

// ── Main component ───────────────────────────────────────────────────────────

export default function Timeline() {
  const navigate = useNavigate();
  const notify   = useNotify();
  const theme    = useTheme();

  // ── In-app events ──────────────────────────────────────────────────────────
  const [events,   setEvents]   = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);

  // Independent filters: upFilter → Coming Up strip, calFilter → calendar body
  const [upFilter,  setUpFilter]  = useState(null);
  const [calFilter, setCalFilter] = useState(null);

  // Calendar navigation
  const [calView, setCalView] = useState(Views.MONTH);
  const [calDate, setCalDate] = useState(new Date());

  // ── Event detail popover ───────────────────────────────────────────────────
  const [eventPopover, setEventPopover] = useState({ anchor: null, event: null });

  function handleSelectEvent(rbcEvent, e) {
    setEventPopover({ anchor: e.currentTarget, event: rbcEvent.resource });
  }
  function handleClosePopover() {
    setEventPopover({ anchor: null, event: null });
  }

  // ── Google Calendar ────────────────────────────────────────────────────────
  const [calToken,      setCalToken]      = useState(() => getStoredToken());
  const [gcalEvents,    setGcalEvents]    = useState([]);
  const [gcalLoading,   setGcalLoading]   = useState(false);
  const [gcalExpired,   setGcalExpired]   = useState(false);
  const [calendarList,  setCalendarList]  = useState([]);
  const [selectedCalIds, setSelectedCalIds] = useState(null); // null until list loads
  const [calListLoading, setCalListLoading] = useState(false);

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true);
    try {
      const [evs, s] = await Promise.all([getEvents(), getSettings()]);
      setEvents(evs);
      setSettings(s);
      const defaultTypes = s?.visible_event_types ?? Object.keys(EVENT_TYPE_META);
      setUpFilter(defaultTypes);
      setCalFilter(defaultTypes);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // Trigger GCal load when token + settings confirm connection
  useEffect(() => {
    if (!calToken || !settings?.google_calendar_token) return;
    (async () => {
      const ids = await loadCalendarList(calToken);
      loadGcalEvents(calToken, ids);
    })();
  }, [calToken, settings?.google_calendar_token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCalendarList(token) {
    setCalListLoading(true);
    try {
      const list = await fetchCalendarList(token);
      setCalendarList(list);
      const allIds    = list.map((c) => c.id);
      const saved     = getSavedCalIds();
      const filtered  = saved ? saved.filter((id) => allIds.includes(id)) : null;
      const ids       = filtered?.length > 0 ? filtered : allIds;
      setSelectedCalIds(ids);
      return ids;
    } catch (err) {
      if (err.status === 401) {
        clearStoredToken();
        setCalToken(null);
        setGcalExpired(true);
        return [];
      }
      // Non-auth error: fall back to primary
      console.error("Could not load calendar list:", err);
      setSelectedCalIds(["primary"]);
      return ["primary"];
    } finally {
      setCalListLoading(false);
    }
  }

  async function loadGcalEvents(token, calIds) {
    if (!token || !calIds?.length) { setGcalEvents([]); return; }
    setGcalLoading(true);
    setGcalExpired(false);
    try {
      const timeMin = dayjs().subtract(3, "month").startOf("day").toISOString();
      const timeMax = dayjs().add(3, "month").endOf("day").toISOString();
      const evs = await fetchCalendarEventsMulti(token, calIds, { timeMin, timeMax });
      setGcalEvents(evs);
    } catch (err) {
      if (err.status === 401) {
        clearStoredToken();
        setCalToken(null);
        setGcalExpired(true);
      } else {
        notify("Could not load Google Calendar events.", "error");
      }
    } finally {
      setGcalLoading(false);
    }
  }

  async function handleReconnect() {
    requestCalendarToken({
      onSuccess: async (token) => {
        setCalToken(token);
        setGcalExpired(false);
        try {
          const updated = await upsertSettings({ ...settings, google_calendar_token: token });
          setSettings(updated);
        } catch { /* non-fatal */ }
      },
      onError: () => notify("Could not reconnect to Google Calendar.", "error"),
      prompt: "",
    });
  }

  function toggleCalendar(id) {
    setSelectedCalIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveCalIds(next);
      if (calToken) loadGcalEvents(calToken, next);
      return next;
    });
  }

  // ── Filter togglers ────────────────────────────────────────────────────────
  function toggleUpFilter(type) {
    setUpFilter((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  function toggleCalFilter(type) {
    setCalFilter((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const isCalConnected = !!settings?.google_calendar_token;
  const now = dayjs();

  // Show GCal card at top when there's something the user needs to act on
  const gcalOnTop = !isCalConnected || gcalExpired || (gcalLoading && gcalEvents.length === 0);

  const upcoming = [
    ...events
      .filter((e) => e.date && dayjs(e.date).isAfter(now))
      .filter((e) => upFilter?.includes(e.type) ?? true),
    ...gcalEvents.filter((e) => e.date && dayjs(e.date).isAfter(now)),
  ]
    .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
    .slice(0, 5);

  const rbcEvents = [
    ...events
      .filter((e) => e.date)
      .filter((e) => calFilter?.includes(e.type) ?? true),
    ...gcalEvents.filter((e) => e.date),
  ].map(toRbcEvent);

  // ── Calendar event styling ─────────────────────────────────────────────────
  const eventPropGetter = useCallback(
    (event) => {
      const ev = event.resource;
      const paletteKey = ev.source === "google"
        ? "secondary"
        : (TYPE_PALETTE_KEY[ev.type] ?? null);
      const bg = paletteKey
        ? (theme.palette[paletteKey]?.main ?? theme.palette.grey[500])
        : theme.palette.grey[500];
      return {
        style: {
          backgroundColor: bg,
          border:          "none",
          color:           "#fff",
          borderRadius:    4,
          fontSize:        12,
          padding:         "1px 5px",
        },
      };
    },
    [theme],
  );

  // ── Google Calendar status card (rendered at top or bottom) ────────────────
  const gcalStatusCard = (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>📆 Google Calendar</Typography>

        {!isCalConnected ? (
          <Alert
            severity="info"
            action={
              <Button size="small" onClick={() => navigate("/settings")}>
                Go to Settings
              </Button>
            }
          >
            Connect your Google Calendar in Settings to see your events here.
          </Alert>
        ) : gcalExpired ? (
          <Alert
            severity="warning"
            action={<Button size="small" onClick={handleReconnect}>Reconnect</Button>}
          >
            Your Google Calendar session expired. Reconnect to see your events.
          </Alert>
        ) : (
          <>
            {gcalLoading || calListLoading ? (
              <Alert severity="info" icon={<CircularProgress size={16} />}>
                Loading your calendar events…
              </Alert>
            ) : (
              <Alert severity="success" icon={<CalendarMonthIcon />}>
                {gcalEvents.length > 0
                  ? `${gcalEvents.length} event${gcalEvents.length === 1 ? "" : "s"} loaded from ${selectedCalIds?.length ?? 1} calendar${(selectedCalIds?.length ?? 1) === 1 ? "" : "s"}.`
                  : "Connected — no events found in the ±3 month window."}
              </Alert>
            )}

            {/* Calendar source toggles */}
            {calendarList.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" fontWeight="medium" color="text.secondary" sx={{ mb: 1 }}>
                  Calendar Sources
                </Typography>
                <Stack spacing={0.25}>
                  {calendarList.map((cal) => (
                    <FormControlLabel
                      key={cal.id}
                      control={
                        <Switch
                          size="small"
                          checked={selectedCalIds?.includes(cal.id) ?? true}
                          onChange={() => toggleCalendar(cal.id)}
                        />
                      }
                      label={
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          {cal.color && (
                            <Box
                              sx={{
                                width:       10,
                                height:      10,
                                borderRadius: "50%",
                                bgcolor:     cal.color,
                                flexShrink:  0,
                              }}
                            />
                          )}
                          <Typography variant="body2">
                            {cal.label}{cal.primary ? " (primary)" : ""}
                          </Typography>
                        </Stack>
                      }
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>Timeline 📅</Typography>

      {/* GCal status floats to top when action is needed */}
      {gcalOnTop && gcalStatusCard}

      {/* ── Coming Up ──────────────────────────────────────────────────────── */}
      {!loading && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{
                mb:             upcoming.length > 0 ? 2 : 0,
                justifyContent: "space-between",
                alignItems:     { sm: "flex-start" },
              }}
            >
              <Typography variant="h6" sx={{ flexShrink: 0 }}>⏰ Coming Up</Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                {Object.entries(EVENT_TYPE_META).map(([type, meta]) => {
                  const active = upFilter?.includes(type) ?? true;
                  return (
                    <Chip
                      key={type}
                      label={meta.label}
                      size="small"
                      color={active ? meta.color : "default"}
                      variant={active ? "filled" : "outlined"}
                      onClick={() => toggleUpFilter(type)}
                      sx={{ cursor: "pointer", fontSize: 11 }}
                    />
                  );
                })}
              </Stack>
            </Stack>

            {upcoming.length === 0 ? (
              <Typography color="text.secondary" variant="body2">
                Nothing coming up — enjoy the breather! 😌
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {upcoming.map((ev) =>
                  ev.source === "google" ? (
                    <Alert key={ev.id} severity="success" icon={<CalendarMonthIcon />}>
                      <strong>Google Calendar</strong>
                      {" — "}
                      {ev.title}
                      {ev.htmlLink && (
                        <IconButton
                          size="small"
                          href={ev.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ ml: 0.5, p: 0 }}
                        >
                          <OpenInNewIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                      {" · "}
                      <em>{dayjs(ev.date).fromNow()}</em>
                      {" ("}
                      {ev.allDay
                        ? dayjs(ev.date).format("MMM D, YYYY") + " · All day"
                        : dayjs(ev.date).format("MMM D, YYYY h:mm A")}
                      {")"}
                    </Alert>
                  ) : (
                    <Alert key={ev.id} severity="info" icon={<EventIcon />}>
                      <strong>{EVENT_TYPE_META[ev.type]?.label ?? ev.type}</strong>
                      {" — "}
                      {eventLabel(ev)}
                      {" · "}
                      <em>{dayjs(ev.date).fromNow()}</em>
                      {" ("}
                      {dayjs(ev.date).format("MMM D, YYYY h:mm A")}
                      {")"}
                    </Alert>
                  ),
                )}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Main Calendar ──────────────────────────────────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {/* In-app event type filter */}
          <FormGroup row sx={{ mb: 2 }}>
            {Object.entries(EVENT_TYPE_META).map(([type, meta]) => (
              <FormControlLabel
                key={type}
                control={
                  <Switch
                    size="small"
                    checked={calFilter?.includes(type) ?? true}
                    onChange={() => toggleCalFilter(type)}
                  />
                }
                label={<Chip label={meta.label} size="small" color={meta.color} />}
              />
            ))}
          </FormGroup>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box
              sx={(t) => ({
                "& .rbc-calendar":                         { fontFamily: "inherit" },
                "& .rbc-today":                            { backgroundColor: t.palette.primary.main + "18" },
                "& .rbc-off-range-bg":                     { backgroundColor: t.palette.action.hover },
                "& .rbc-header":                           { borderColor: t.palette.divider, padding: "6px 4px", fontWeight: 600, fontSize: 13 },
                "& .rbc-month-view":                       { borderColor: t.palette.divider },
                "& .rbc-day-bg + .rbc-day-bg":            { borderColor: t.palette.divider },
                "& .rbc-month-row + .rbc-month-row":      { borderColor: t.palette.divider },
                "& .rbc-time-view":                        { borderColor: t.palette.divider },
                "& .rbc-time-header-content":              { borderColor: t.palette.divider },
                "& .rbc-time-content":                     { borderColor: t.palette.divider },
                "& .rbc-timeslot-group":                   { borderColor: t.palette.divider },
                "& .rbc-current-time-indicator":           { backgroundColor: t.palette.error.main },
                "& .rbc-agenda-view table.rbc-agenda-table": { borderColor: t.palette.divider },
                "& .rbc-agenda-table tbody > tr > td":    { borderColor: t.palette.divider },
                "& .rbc-agenda-table tbody > tr + tr":    { borderColor: t.palette.divider },
                "& .rbc-show-more":                        { color: t.palette.primary.main, fontWeight: 600, fontSize: 12 },
                // Let month rows expand naturally — showAllEvents handles the rest
                "& .rbc-month-view":                       { height: "auto" },
                "& .rbc-month-row":                        { overflow: "visible" },
              })}
            >
              <Calendar
                localizer={localizer}
                events={rbcEvents}
                view={calView}
                date={calDate}
                onView={setCalView}
                onNavigate={setCalDate}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventPropGetter}
                components={RBC_COMPONENTS}
                style={{ height: "auto", minHeight: 600 }}
                showAllEvents
                showMultiDayTimes
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* GCal status sits quietly at bottom when everything is working */}
      {!gcalOnTop && gcalStatusCard}

      {/* ── Event detail popover ───────────────────────────────────────────── */}
      <Popover
        open={Boolean(eventPopover.anchor)}
        anchorEl={eventPopover.anchor}
        onClose={handleClosePopover}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 2, maxWidth: 340 } } }}
      >
        {eventPopover.event && (() => {
          const ev = eventPopover.event;
          const isGcal = ev.source === "google";
          const typeLabel = EVENT_TYPE_META[ev.type]?.label;
          const typeColor = EVENT_TYPE_META[ev.type]?.color ?? "default";
          const dateStr = ev.allDay
            ? dayjs(ev.date).format("dddd, MMMM D, YYYY") + " · All day"
            : dayjs(ev.date).format("dddd, MMMM D, YYYY [at] h:mm A");

          return (
            <Stack spacing={1.5}>
              {/* Title row */}
              <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                {isGcal
                  ? <CalendarMonthIcon sx={{ fontSize: 18, color: "secondary.main", mt: "2px", flexShrink: 0 }} />
                  : <EventIcon sx={{ fontSize: 18, color: "primary.main", mt: "2px", flexShrink: 0 }} />
                }
                <Typography variant="subtitle2" fontWeight="bold" sx={{ lineHeight: 1.3 }}>
                  {isGcal ? ev.title : calEventTitle(ev)}
                </Typography>
              </Stack>

              {/* Type chip (in-app only) */}
              {!isGcal && typeLabel && (
                <Chip label={typeLabel} color={typeColor} size="small" sx={{ alignSelf: "flex-start" }} />
              )}
              {isGcal && (
                <Chip label="Google Calendar" color="secondary" size="small" sx={{ alignSelf: "flex-start" }} />
              )}

              {/* Date */}
              <Typography variant="body2" color="text.secondary">
                📅 {dateStr}
              </Typography>

              {/* Notes / description */}
              {(ev.notes || ev.description) && (
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {ev.notes ?? ev.description}
                </Typography>
              )}

              {/* GCal link */}
              {isGcal && ev.htmlLink && (
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                  href={ev.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ alignSelf: "flex-start" }}
                >
                  Open in Google Calendar
                </Button>
              )}
            </Stack>
          );
        })()}
      </Popover>
    </Box>
  );
}
