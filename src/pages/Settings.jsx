import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { upsertSettings } from "../services/settingsService";
import { useNotify } from "../context/NotificationContext";
import { requestCalendarToken, clearStoredToken } from "../utils/googleAuth";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

const ALL_EVENT_TYPES = [
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "rejection", label: "Rejection" },
  { value: "follow_up", label: "Follow Up" },
  { value: "chat", label: "Chat" },
  { value: "other", label: "Other" },
  { value: "entity_created", label: "Entity Created (auto)" },
  { value: "discovered", label: "Discovered (auto)" },
  { value: "status_change", label: "Status Change (auto)" },
];

const PRIMARY_COLORS = [
  { label: "Blue", value: "#1976d2" },
  { label: "Purple", value: "#7b1fa2" },
  { label: "Teal", value: "#00796b" },
  { label: "Green", value: "#388e3c" },
  { label: "Orange", value: "#e65100" },
  { label: "Red", value: "#c62828" },
];

const SECONDARY_COLORS = [
  { label: "Purple", value: "#9c27b0" },
  { label: "Pink",   value: "#e91e63" },
  { label: "Amber",  value: "#f59e0b" },
  { label: "Cyan",   value: "#0891b2" },
];

const BACKGROUND_COLORS = [
  { label: "Default",     value: null       },
  { label: "Warm White",  value: "#fafaf7"  },
  { label: "Cool Gray",   value: "#f0f2f5"  },
  { label: "Soft Blue",   value: "#eef4fb"  },
  { label: "Soft Green",  value: "#eef7f0"  },
  { label: "Warm Cream",  value: "#fdf8ef"  },
];

function ColorSwatch({ colors, selected, onSelect }) {
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
      {colors.map((c) => {
        const isSelected = selected === c.value; // works for null === null too
        return (
          <Box
            key={c.value ?? "__default__"}
            onClick={() => onSelect(c.value)}
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              bgcolor: c.value ?? "#ffffff",
              cursor: "pointer",
              border: isSelected ? "3px solid" : "3px solid transparent",
              borderColor: isSelected ? "text.primary" : "transparent",
              outline: isSelected ? "2px solid white" : "none",
              outlineOffset: "-5px",
              // For the null/default swatch show a subtle ring so it's visible on any bg
              boxShadow: !c.value ? "0 0 0 1px rgba(0,0,0,0.18)" : "none",
              transition: "transform 0.1s",
              "&:hover": { transform: "scale(1.15)" },
            }}
            title={c.label}
          />
        );
      })}
    </Stack>
  );
}

export default function Settings({ settings, onSettingsChange }) {
  const notify = useNotify();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [calSaving, setCalSaving] = useState(false);

  const calConnected = !!settings?.google_calendar_token;

  async function handleCalConnect() {
    setCalSaving(true);
    requestCalendarToken({
      onSuccess: async (token) => {
        try {
          const updated = await upsertSettings({ ...settings, google_calendar_token: token });
          onSettingsChange?.(updated);
          notify("Google Calendar connected! 🗓️", "success");
        } catch (err) {
          notify(err.message, "error");
        } finally {
          setCalSaving(false);
        }
      },
      onError: (msg) => {
        notify(msg || "Could not connect to Google Calendar", "error");
        setCalSaving(false);
      },
      prompt: "consent",
    });
  }

  async function handleCalDisconnect() {
    setCalSaving(true);
    try {
      clearStoredToken();
      const updated = await upsertSettings({ ...settings, google_calendar_token: null });
      onSettingsChange?.(updated);
      notify("Google Calendar disconnected.", "info");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setCalSaving(false);
    }
  }

  useEffect(() => {
    if (settings) {
      setForm({
        daily_goal: settings.daily_goal ?? 2,
        stale_days: settings.stale_days ?? 7,
        ghost_days: settings.ghost_days ?? 14,
        visible_event_types: settings.visible_event_types ?? ALL_EVENT_TYPES.map((t) => t.value),
        pomodoro_work_min: settings.pomodoro_work_min ?? 25,
        pomodoro_break_min: settings.pomodoro_break_min ?? 5,
        session_tracker_enabled: settings.session_tracker_enabled ?? true,
        session_tracker_interval_min: settings.session_tracker_interval_min ?? 30,
        theme_primary:    settings.theme_primary    ?? "#1976d2",
        theme_secondary:  settings.theme_secondary  ?? "#9c27b0",
        theme_background: settings.theme_background ?? null,
      });
    }
  }, [settings]);

  function toggleEventType(type) {
    setForm((f) => {
      const current = f.visible_event_types ?? [];
      const next = current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type];
      return { ...f, visible_event_types: next };
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await upsertSettings(form);
      onSettingsChange?.(updated);
      notify("Settings saved! ✨", "success");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>Settings</Typography>

      <Stack spacing={3}>
        {/* Alert thresholds */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Smart Alert Thresholds</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Control when the dashboard shows you nudges and reminders.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Stale position alert (days)"
                type="number"
                value={form.stale_days}
                onChange={(e) => setForm((f) => ({ ...f, stale_days: parseInt(e.target.value) || 7 }))}
                helperText="Show alert if active position not updated in this many days"
                fullWidth
              />
              <TextField
                label="Ghosted application alert (days)"
                type="number"
                value={form.ghost_days}
                onChange={(e) => setForm((f) => ({ ...f, ghost_days: parseInt(e.target.value) || 14 }))}
                helperText="Show alert if application has no activity in this many days"
                fullWidth
              />
            </Stack>
          </CardContent>
        </Card>

        {/* Daily goal */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Daily Goal</Typography>
            <TextField
              label="Applications to submit per day"
              type="number"
              value={form.daily_goal}
              onChange={(e) => setForm((f) => ({ ...f, daily_goal: parseInt(e.target.value) || 1 }))}
              slotProps={{ htmlInput: { min: 1, max: 20 } }}
              sx={{ width: 260 }}
              helperText="Shows as a motivational target on the Dashboard"
            />
          </CardContent>
        </Card>

        {/* Event visibility */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Timeline Event Visibility</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose which event types appear in your Timeline feed. All events are still recorded.
            </Typography>
            <Stack spacing={0.5}>
              {ALL_EVENT_TYPES.map((t) => (
                <FormControlLabel
                  key={t.value}
                  control={
                    <Switch
                      checked={(form.visible_event_types ?? []).includes(t.value)}
                      onChange={() => toggleEventType(t.value)}
                      size="small"
                    />
                  }
                  label={t.label}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Pomodoro */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Pomodoro Timer</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Work duration (minutes)"
                type="number"
                value={form.pomodoro_work_min}
                onChange={(e) => setForm((f) => ({ ...f, pomodoro_work_min: parseInt(e.target.value) || 25 }))}
                slotProps={{ htmlInput: { min: 1, max: 120 } }}
                fullWidth
              />
              <TextField
                label="Break duration (minutes)"
                type="number"
                value={form.pomodoro_break_min}
                onChange={(e) => setForm((f) => ({ ...f, pomodoro_break_min: parseInt(e.target.value) || 5 }))}
                slotProps={{ htmlInput: { min: 1, max: 60 } }}
                fullWidth
              />
            </Stack>
          </CardContent>
        </Card>

        {/* Session tracker */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Session Time Tracker</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Get a little celebration notification for how long you've been job hunting today 🎉
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={form.session_tracker_enabled}
                  onChange={(e) => setForm((f) => ({ ...f, session_tracker_enabled: e.target.checked }))}
                />
              }
              label="Enable session time tracker"
            />
            {form.session_tracker_enabled && (
              <TextField
                label="Notification interval (minutes)"
                type="number"
                value={form.session_tracker_interval_min}
                onChange={(e) => setForm((f) => ({ ...f, session_tracker_interval_min: parseInt(e.target.value) || 30 }))}
                slotProps={{ htmlInput: { min: 5, max: 120 } }}
                sx={{ mt: 2, width: 260 }}
              />
            )}
          </CardContent>
        </Card>

        {/* Theme */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Theme Colors</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Pick your vibe. Changes apply after saving.
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>Primary Color</Typography>
                <ColorSwatch
                  colors={PRIMARY_COLORS}
                  selected={form.theme_primary}
                  onSelect={(v) => setForm((f) => ({ ...f, theme_primary: v }))}
                />
              </Box>
              <Box>
                <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>Secondary / Accent Color</Typography>
                <ColorSwatch
                  colors={SECONDARY_COLORS}
                  selected={form.theme_secondary}
                  onSelect={(v) => setForm((f) => ({ ...f, theme_secondary: v }))}
                />
              </Box>
              <Box>
                <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>Page Background</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  Default uses MUI's standard background.
                </Typography>
                <ColorSwatch
                  colors={BACKGROUND_COLORS}
                  selected={form.theme_background}
                  onSelect={(v) => setForm((f) => ({ ...f, theme_background: v }))}
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Google Calendar */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Google Calendar</Typography>
            {calConnected ? (
              <Stack spacing={2}>
                <Alert severity="success">
                  Connected! Your Google Calendar events will appear in the Timeline. 🗓️
                </Alert>
                <Box>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleCalDisconnect}
                    disabled={calSaving}
                    size="small"
                  >
                    {calSaving ? <CircularProgress size={18} color="inherit" /> : "Disconnect Google Calendar"}
                  </Button>
                </Box>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Connect your Google Calendar to see your upcoming events alongside your job activity in the Timeline.
                </Typography>
                <Box>
                  <Button
                    variant="contained"
                    startIcon={calSaving ? <CircularProgress size={18} color="inherit" /> : <CalendarMonthIcon />}
                    onClick={handleCalConnect}
                    disabled={calSaving}
                  >
                    Connect Google Calendar
                  </Button>
                </Box>
              </Stack>
            )}
          </CardContent>
        </Card>

        <Divider />
        <Box>
          <Button variant="contained" size="large" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={22} color="inherit" /> : "Save Settings"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
