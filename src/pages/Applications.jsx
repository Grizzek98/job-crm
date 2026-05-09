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
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from "../services/applicationService";
import { getPositions } from "../services/positionService";
import { getDocuments } from "../services/documentService";
import { useNotify } from "../context/NotificationContext";

const emptyForm = {
  position_id: "",
  status: "applied",
  applied_date: "",
  resume_id: "",
  cover_letter_id: "",
  notes: "",
};

const STATUS_OPTIONS = [
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offered", label: "Offered" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "ghosted", label: "Ghosted" },
];

function statusColor(status) {
  switch (status) {
    case "applied":
      return "primary";
    case "interviewing":
      return "info";
    case "offered":
      return "warning";
    case "accepted":
      return "success";
    case "declined":
    case "rejected":
    case "withdrawn":
      return "error";
    default:
      return "default"; // ghosted
  }
}

function statusLabel(status) {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Applications() {
  const notify = useNotify();
  const [applications, setApplications] = useState([]);
  const [positions, setPositions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingApplication, setEditingApplication] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadApplications();
    loadPositions();
    loadDocuments();
  }, []);

  async function loadApplications() {
    try {
      setLoading(true);
      const data = await getApplications();
      setApplications(data);
    } catch (err) {
      notify(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPositions() {
    try {
      const data = await getPositions();
      setPositions(data);
    } catch (err) {
      notify(err.message);
    }
  }

  async function loadDocuments() {
    try {
      const data = await getDocuments();
      setDocuments(data);
    } catch (err) {
      notify(err.message);
    }
  }

  const resumeDocs = documents.filter((d) => d.type === "resume");
  const coverLetterDocs = documents.filter((d) => d.type === "cover_letter");

  function openAddDialog() {
    setEditingApplication(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(application) {
    setEditingApplication(application);
    setForm({
      position_id: application.position_id ?? "",
      status: application.status ?? "applied",
      applied_date: application.applied_date ?? "",
      resume_id: application.resume_id ?? "",
      cover_letter_id: application.cover_letter_id ?? "",
      notes: application.notes ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingApplication(null);
    setForm(emptyForm);
  }

  function handleFormChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (!form.position_id) return;
    setSaving(true);
    try {
      const payload = {
        position_id: form.position_id,
        status: form.status,
        applied_date: form.applied_date || null,
        resume_id: form.resume_id || null,
        cover_letter_id: form.cover_letter_id || null,
        notes: form.notes.trim() || null,
      };

      if (editingApplication) {
        const updated = await updateApplication(editingApplication.id, payload);
        setApplications((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a)),
        );
      } else {
        const created = await createApplication(payload);
        setApplications((prev) => [created, ...prev]);
      }

      closeDialog();
    } catch (err) {
      notify(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deleteApplication(deleteTarget.id);
      setApplications((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    } catch (err) {
      notify(err.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}
      >
        <Typography variant="h5" fontWeight="bold">
          Applications
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAddDialog}
        >
          Add Application
        </Button>
      </Stack>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
              <CircularProgress />
            </Box>
          ) : applications.length === 0 ? (
            <Box sx={{ textAlign: "center", p: 6 }}>
              <Typography color="text.secondary">
                No applications yet. Add one to get started.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Position</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Applied</TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>Notes</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id} hover>
                      <TableCell>
                        <Typography fontWeight="medium">
                          {app.positions?.name ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {app.positions?.companies?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        {app.status ? (
                          <Chip
                            label={statusLabel(app.status)}
                            size="small"
                            color={statusColor(app.status)}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{formatDate(app.applied_date)}</TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                        >
                          {app.notes ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(app)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(app)}
                          >
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

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingApplication ? "Edit Application" : "Add Application"}
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Position</InputLabel>
              <Select
                name="position_id"
                value={form.position_id}
                label="Position"
                onChange={handleFormChange}
              >
                <MenuItem value="">
                  <em>Select a position</em>
                </MenuItem>
                {positions.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                    {p.companies ? ` — ${p.companies.name}` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={form.status}
                label="Status"
                onChange={handleFormChange}
              >
                {STATUS_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Applied Date"
              name="applied_date"
              value={form.applied_date}
              onChange={handleFormChange}
              type="date"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormControl fullWidth>
              <InputLabel>Resume</InputLabel>
              <Select
                name="resume_id"
                value={form.resume_id}
                label="Resume"
                onChange={handleFormChange}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {resumeDocs.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Cover Letter</InputLabel>
              <Select
                name="cover_letter_id"
                value={form.cover_letter_id}
                label="Cover Letter"
                onChange={handleFormChange}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {coverLetterDocs.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Notes"
              name="notes"
              value={form.notes}
              onChange={handleFormChange}
              multiline
              rows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeDialog} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.position_id}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Application</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the application for{" "}
            <strong>{deleteTarget?.positions?.name ?? "this position"}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
