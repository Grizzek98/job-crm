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
import { getJobSites, createJobSite, updateJobSite, deleteJobSite } from "../services/jobSiteService";
import { useNotify } from "../context/NotificationContext";
import { normalizeUrl } from "../utils/url";

const emptyForm = { name: "", url: "", username: "", notes: "" };

export default function JobSites() {
  const notify = useNotify();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { loadSites(); }, []);

  async function loadSites() {
    setLoading(true);
    try {
      setSites(await getJobSites());
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingSite(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(s) {
    setEditingSite(s);
    setForm({ name: s.name ?? "", url: s.url ?? "", username: s.username ?? "", notes: s.notes ?? "" });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingSite(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        url: normalizeUrl(form.url.trim()),
        username: form.username.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editingSite) {
        const updated = await updateJobSite(editingSite.id, payload);
        setSites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const created = await createJobSite(payload);
        setSites((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      notify("Saved!", "success");
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
      await deleteJobSite(deleteTarget.id);
      setSites((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      notify("Removed.", "success");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Job Sites</Typography>
          <Typography variant="body2" color="text.secondary">
            Your go-to job boards — with your usernames saved for easy access 🔍
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Add Site
        </Button>
      </Stack>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}><CircularProgress /></Box>
          ) : sites.length === 0 ? (
            <Box sx={{ textAlign: "center", p: 6 }}>
              <Typography color="text.secondary">No job sites yet. Add your favourites!</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>URL</TableCell>
                    <TableCell>Username</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sites.map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <Typography fontWeight="medium">{s.name}</Typography>
                          {s.is_preset && <Chip label="Preset" size="small" variant="outlined" />}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={s.url}>
                          <IconButton size="small" href={s.url} target="_blank" rel="noopener noreferrer">
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={s.username ? "text.primary" : "text.disabled"}>
                          {s.username ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                          {s.notes ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(s)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {!s.is_preset && (
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => setDeleteTarget(s)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
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
        <DialogTitle>{editingSite ? "Edit Job Site" : "Add Job Site"}</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Site Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required fullWidth autoFocus />
            <TextField label="URL" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} required fullWidth placeholder="https://linkedin.com" />
            <TextField label="Your Username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} fullWidth placeholder="your.email@example.com" />
            <TextField label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} fullWidth multiline rows={2} />
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim() || !form.url.trim()}>
            {saving ? <CircularProgress size={20} color="inherit" /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Remove Job Site</DialogTitle>
        <DialogContent>
          <Typography>Remove <strong>{deleteTarget?.name}</strong>? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Remove</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
