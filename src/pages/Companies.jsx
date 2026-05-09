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
  IconButton,
  InputAdornment,
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
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
} from "../services/companyService";
import { useNotify } from "../context/NotificationContext";
import { normalizeUrl } from "../utils/url";

const emptyForm = {
  name: "",
  size: "",
  url: "",
  glassdoor_rating: "",
  notes: "",
};


export default function Companies() {
  const notify = useNotify();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null); // null = adding new
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // --- Data loading ---

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    try {
      setLoading(true);
      const data = await getCompanies();
      setCompanies(data);
    } catch (err) {
      notify(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- Dialog handlers ---

  function openAddDialog() {
    setEditingCompany(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(company) {
    setEditingCompany(company);
    setForm({
      name: company.name ?? "",
      size: company.size ?? "",
      url: company.url ?? "",
      glassdoor_rating: company.glassdoor_rating ?? "",
      notes: company.notes ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingCompany(null);
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
        name: form.name.trim(),
        size: form.size ? parseInt(form.size) : null,
        url: normalizeUrl(form.url.trim()),
        glassdoor_rating: form.glassdoor_rating
          ? parseFloat(form.glassdoor_rating)
          : null,
        notes: form.notes.trim() || null,
      };

      if (editingCompany) {
        const updated = await updateCompany(editingCompany.id, payload);
        setCompanies((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
      } else {
        const created = await createCompany(payload);
        setCompanies((prev) =>
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
      await deleteCompany(deleteTarget.id);
      setCompanies((prev) => prev.filter((c) => c.id !== deleteTarget.id));
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
          Companies
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAddDialog}
        >
          Add Company
        </Button>
      </Stack>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
              <CircularProgress />
            </Box>
          ) : companies.length === 0 ? (
            <Box sx={{ textAlign: "center", p: 6 }}>
              <Typography color="text.secondary">
                No companies yet. Add one to get started.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Glassdoor</TableCell>
                    <TableCell>Website</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id} hover>
                      <TableCell>
                        <Typography fontWeight="medium">
                          {company.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {company.size ? company.size.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        {company.glassdoor_rating ? (
                          <Chip
                            label={company.glassdoor_rating}
                            size="small"
                            color={
                              company.glassdoor_rating >= 4
                                ? "success"
                                : company.glassdoor_rating >= 3
                                  ? "warning"
                                  : "error"
                            }
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {company.url ? (
                          <Tooltip title={company.url}>
                            <IconButton
                              size="small"
                              href={normalizeUrl(company.url)}
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
                      <TableCell sx={{ maxWidth: 200 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                        >
                          {company.notes ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(company)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(company)}
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
          {editingCompany ? "Edit Company" : "Add Company"}
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Company Name"
              name="name"
              value={form.name}
              onChange={handleFormChange}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Number of Employees"
              name="size"
              value={form.size}
              onChange={handleFormChange}
              type="number"
              fullWidth
            />
            <TextField
              label="Website URL"
              name="url"
              value={form.url}
              onChange={handleFormChange}
              fullWidth
            />
            <TextField
              label="Glassdoor Rating"
              name="glassdoor_rating"
              value={form.glassdoor_rating}
              onChange={handleFormChange}
              type="number"
              inputProps={{ min: 0, max: 5, step: 0.1 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">/ 5</InputAdornment>
                ),
              }}
              fullWidth
            />
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
            disabled={saving || !form.name.trim()}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Company</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{" "}
            <strong>{deleteTarget?.name}</strong>? This will also delete all
            associated positions, applications, and events.
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
