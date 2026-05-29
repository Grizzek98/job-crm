import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { LocalizationProvider, DateTimePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { getEvents, createEvent, updateEvent, deleteEvent } from "../services/eventService";
import { getApplications } from "../services/applicationService";
import { useNotify } from "../context/NotificationContext";

const EVENT_TYPES = [
  { value: "interview", label: "Interview", color: "primary" },
  { value: "offer", label: "Offer", color: "success" },
  { value: "rejection", label: "Rejection", color: "error" },
  { value: "follow_up", label: "Follow Up", color: "warning" },
  { value: "chat", label: "Chat", color: "info" },
  { value: "other", label: "Other", color: "default" },
  { value: "entity_created", label: "Created", color: "default" },
  { value: "discovered", label: "Discovered", color: "secondary" },
  { value: "status_change", label: "Status Change", color: "info" },
];

function typeChip(type) {
  const t = EVENT_TYPES.find((e) => e.value === type);
  return <Chip label={t?.label ?? type} size="small" color={t?.color ?? "default"} />;
}

function appLabel(event) {
  const pos = event.applications?.positions;
  if (!pos) return "—";
  const company = pos.companies?.name ?? "";
  return company ? `${pos.name} @ ${company}` : pos.name;
}

const emptyForm = {
  application_id: "",
  type: "interview",
  date: dayjs(),
  notes: "",
};

export default function Events() {
  const notify = useNotify();
  const [events, setEvents] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [evs, apps] = await Promise.all([getEvents(), getApplications()]);
      setEvents(evs);
      setApplications(apps);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingEvent(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(ev) {
    setEditingEvent(ev);
    setForm({
      application_id: ev.application_id ?? "",
      type: ev.type ?? "interview",
      date: ev.date ? dayjs(ev.date) : dayjs(),
      notes: ev.notes ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingEvent(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        application_id: form.application_id || null,
        type: form.type,
        date: form.date?.toISOString() ?? new Date().toISOString(),
        notes: form.notes.trim() || null,
      };
      if (editingEvent) {
        const updated = await updateEvent(editingEvent.id, payload);
        setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      } else {
        const created = await createEvent(payload);
        setEvents((prev) => [created, ...prev]);
      }
      notify("Event saved!", "success");
      closeDialog();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteEvent(deleteTarget.id);
      setEvents((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      notify("Event deleted.", "success");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Typography variant="h5" fontWeight="bold">Events</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
            Add Event
          </Button>
        </Stack>

        <Card>
          <CardContent sx={{ p: 0 }}>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                <CircularProgress />
              </Box>
            ) : events.length === 0 ? (
              <Box sx={{ textAlign: "center", p: 6 }}>
                <Typography color="text.secondary">
                  No events yet — they'll start appearing as you use the app! 📅
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Application</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Notes</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {events.map((ev) => (
                      <TableRow key={ev.id} hover>
                        <TableCell>{typeChip(ev.type)}</TableCell>
                        <TableCell>{appLabel(ev)}</TableCell>
                        <TableCell>
                          {ev.date ? dayjs(ev.date).format("MMM D, YYYY h:mm A") : "—"}
                        </TableCell>
                        <TableCell>
                          <Tooltip title={ev.notes ?? ""}>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {ev.notes ?? "—"}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(ev)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => setDeleteTarget(ev)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{editingEvent ? "Edit Event" : "Add Event"}</DialogTitle>
          <Divider />
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Application (optional)</InputLabel>
                <Select
                  value={form.application_id}
                  label="Application (optional)"
                  onChange={(e) => setForm((f) => ({ ...f, application_id: e.target.value }))}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {applications.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.positions?.name ?? "—"} @ {a.positions?.companies?.name ?? "—"}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={form.type}
                  label="Type"
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                >
                  {EVENT_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <DateTimePicker
                label="Date & Time"
                value={form.date}
                onChange={(val) => setForm((f) => ({ ...f, date: val }))}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <TextField
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                multiline
                minRows={3}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? <CircularProgress size={20} color="inherit" /> : "Save"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
          <DialogTitle>Delete Event</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to delete this event? This cannot be undone.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
