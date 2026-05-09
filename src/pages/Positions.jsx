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
  InputAdornment,
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
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  getPositions,
  createPosition,
  updatePosition,
  deletePosition,
} from "../services/positionService";
import { getCompanies } from "../services/companyService";
import { useNotify } from "../context/NotificationContext";
import { normalizeUrl } from "../utils/url";

const emptyForm = {
  company_id: "",
  name: "",
  status: "active",
  type: "",
  location: "",
  pay_min: "",
  pay_max: "",
  pay_type: "",
  url_listing: "",
  url_application: "",
  description: "",
  notes: "",
};

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "applying", label: "Applying" },
  { value: "applied", label: "Applied" },
  { value: "not_interested", label: "Not Interested" },
  { value: "closed", label: "Closed" },
];

const TYPE_OPTIONS = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "temporary", label: "Temporary" },
];

const PAY_TYPE_OPTIONS = [
  { value: "hourly", label: "Hourly" },
  { value: "salary", label: "Salary" },
];

function statusColor(status) {
  switch (status) {
    case "active":
      return "primary";
    case "applying":
    case "applied":
      return "info";
    case "closed":
      return "error";
    default:
      return "default";
  }
}

function statusLabel(status) {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function typeLabel(type) {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

function formatPay(position) {
  if (!position.pay_min && !position.pay_max) return "—";
  const fmt = (n) => (n != null ? `$${Number(n).toLocaleString()}` : null);
  const min = fmt(position.pay_min);
  const max = fmt(position.pay_max);
  const range = [min, max].filter(Boolean).join(" – ");
  const suffix =
    position.pay_type === "hourly"
      ? "/hr"
      : position.pay_type === "salary"
        ? "/yr"
        : "";
  return range + suffix;
}

export default function Positions() {
  const notify = useNotify();
  const [positions, setPositions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // --- Data loading ---

  useEffect(() => {
    loadPositions();
    loadCompanies();
  }, []);

  async function loadPositions() {
    try {
      setLoading(true);
      const data = await getPositions();
      setPositions(data);
    } catch (err) {
      notify(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanies() {
    try {
      const data = await getCompanies();
      setCompanies(data);
    } catch (err) {
      notify(err.message);
    }
  }

  // --- Dialog handlers ---

  function openAddDialog() {
    setEditingPosition(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(position) {
    setEditingPosition(position);
    setForm({
      company_id: position.company_id ?? "",
      name: position.name ?? "",
      status: position.status ?? "active",
      type: position.type ?? "",
      location: position.location ?? "",
      pay_min: position.pay_min ?? "",
      pay_max: position.pay_max ?? "",
      pay_type: position.pay_type ?? "",
      url_listing: position.url_listing ?? "",
      url_application: position.url_application ?? "",
      description: position.description ?? "",
      notes: position.notes ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingPosition(null);
    setForm(emptyForm);
  }

  function handleFormChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        company_id: form.company_id || null,
        name: form.name.trim(),
        status: form.status || "active",
        type: form.type || null,
        location: form.location.trim() || null,
        pay_min: form.pay_min !== "" ? parseFloat(form.pay_min) : null,
        pay_max: form.pay_max !== "" ? parseFloat(form.pay_max) : null,
        pay_type: form.pay_type || null,
        url_listing: normalizeUrl(form.url_listing.trim()) || null,
        url_application: normalizeUrl(form.url_application.trim()) || null,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingPosition) {
        const updated = await updatePosition(editingPosition.id, payload);
        setPositions((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
      } else {
        const created = await createPosition(payload);
        setPositions((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
        );
      }

      closeDialog();
    } catch (err) {
      notify(err.message);
    } finally {
      setSaving(false);
    }
  }

  // --- Delete handlers ---

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deletePosition(deleteTarget.id);
      setPositions((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    } catch (err) {
      notify(err.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  // --- Render ---

  return (
    <Box>
      {/* Page header */}
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}
      >
        <Typography variant="h5" fontWeight="bold">
          Positions
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAddDialog}
        >
          Add Position
        </Button>
      </Stack>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
              <CircularProgress />
            </Box>
          ) : positions.length === 0 ? (
            <Box sx={{ textAlign: "center", p: 6 }}>
              <Typography color="text.secondary">
                No positions yet. Add one to get started.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Job Title</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Pay</TableCell>
                    <TableCell>Listing</TableCell>
                    <TableCell>Application</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow key={position.id} hover>
                      <TableCell>
                        <Typography fontWeight="medium">
                          {position.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{position.companies?.name ?? "—"}</TableCell>
                      <TableCell>
                        {position.status ? (
                          <Chip
                            label={statusLabel(position.status)}
                            size="small"
                            color={statusColor(position.status)}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {position.type ? typeLabel(position.type) : "—"}
                      </TableCell>
                      <TableCell>{position.location ?? "—"}</TableCell>
                      <TableCell>{formatPay(position)}</TableCell>
                      <TableCell>
                        {position.url_listing ? (
                          <Tooltip title={position.url_listing}>
                            <IconButton
                              size="small"
                              href={position.url_listing}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {position.url_application ? (
                          <Tooltip title={position.url_application}>
                            <IconButton
                              size="small"
                              href={position.url_application}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(position)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(position)}
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

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingPosition ? "Edit Position" : "Add Position"}
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Job Title"
              name="name"
              value={form.name}
              onChange={handleFormChange}
              required
              fullWidth
              autoFocus
            />
            <FormControl fullWidth>
              <InputLabel>Company</InputLabel>
              <Select
                name="company_id"
                value={form.company_id}
                label="Company"
                onChange={handleFormChange}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {companies.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
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
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                name="type"
                value={form.type}
                label="Type"
                onChange={handleFormChange}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {TYPE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Location"
              name="location"
              value={form.location}
              onChange={handleFormChange}
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Pay Min"
                name="pay_min"
                value={form.pay_min}
                onChange={handleFormChange}
                type="number"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
                fullWidth
              />
              <TextField
                label="Pay Max"
                name="pay_max"
                value={form.pay_max}
                onChange={handleFormChange}
                type="number"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
                fullWidth
              />
            </Stack>
            <FormControl fullWidth>
              <InputLabel>Pay Type</InputLabel>
              <Select
                name="pay_type"
                value={form.pay_type}
                label="Pay Type"
                onChange={handleFormChange}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {PAY_TYPE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Listing URL"
              name="url_listing"
              value={form.url_listing}
              onChange={handleFormChange}
              fullWidth
            />
            <TextField
              label="Application URL"
              name="url_application"
              value={form.url_application}
              onChange={handleFormChange}
              fullWidth
            />
            <TextField
              label="Description"
              name="description"
              value={form.description}
              onChange={handleFormChange}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Notes"
              name="notes"
              value={form.notes}
              onChange={handleFormChange}
              multiline
              rows={2}
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
            disabled={saving || !form.name.trim()}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Position</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{" "}
            <strong>{deleteTarget?.name}</strong>?
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
