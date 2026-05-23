import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
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
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { getFocusVideos, createFocusVideo, updateFocusVideo, deleteFocusVideo } from "../services/focusVideoService";
import { useNotify } from "../context/NotificationContext";
import { useFocus } from "../context/FocusContext";
import { extractYouTubeId } from "../utils/youtube";

const emptyForm = { title: "", url: "", notes: "" };

export default function Focus() {
  const notify = useNotify();
  const { setCurrentVideo } = useFocus();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadVideos();
  }, []);

  async function loadVideos() {
    setLoading(true);
    try {
      setVideos(await getFocusVideos());
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingVideo(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(v) {
    setEditingVideo(v);
    setForm({ title: v.title ?? "", url: v.url ?? "", notes: v.notes ?? "" });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingVideo(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.url.trim()) return;
    if (!extractYouTubeId(form.url)) {
      notify("Please enter a valid YouTube URL.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = { title: form.title.trim(), url: form.url.trim(), notes: form.notes.trim() || null };
      if (editingVideo) {
        const updated = await updateFocusVideo(editingVideo.id, payload);
        setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      } else {
        const created = await createFocusVideo(payload);
        setVideos((prev) => [created, ...prev]);
      }
      notify("Video saved!", "success");
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
      await deleteFocusVideo(deleteTarget.id);
      setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      notify("Video removed.", "success");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleToggleFavorite(v) {
    try {
      const updated = await updateFocusVideo(v.id, { is_favorite: !v.is_favorite });
      setVideos((prev) => {
        const next = prev.map((vid) => (vid.id === updated.id ? updated : vid));
        // Keep favorites sorted to top
        return [...next].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
      });
    } catch (err) {
      notify(err.message, "error");
    }
  }

  function loadVideo(v) {
    setCurrentVideo({ id: v.id, title: v.title, url: v.url });
    notify(`Now playing: ${v.title} 🎵`, "info");
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Focus Tools</Typography>
          <Typography variant="body2" color="text.secondary">
            Your YouTube study music library — keep the vibes going while you job hunt 🎶
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Add Video
        </Button>
      </Stack>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
              <CircularProgress />
            </Box>
          ) : videos.length === 0 ? (
            <Box sx={{ textAlign: "center", p: 6 }}>
              <Typography variant="h6" gutterBottom>No focus videos yet!</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Add a YouTube link to get your focus music going. Lofi beats, study streams, whatever gets you in the zone 🎧
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
                Add Your First Video
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 40 }} />
                    <TableCell>Title</TableCell>
                    <TableCell>URL</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {videos.map((v) => (
                    <TableRow key={v.id} hover>
                      <TableCell sx={{ pr: 0 }}>
                        <Tooltip title={v.is_favorite ? "Unfavorite" : "Mark as favorite"}>
                          <IconButton size="small" onClick={() => handleToggleFavorite(v)} color={v.is_favorite ? "warning" : "default"}>
                            {v.is_favorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={v.is_favorite ? "bold" : "medium"}>{v.title}</Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={v.url}>
                          <IconButton
                            size="small"
                            href={v.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                          {v.notes ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Play in mini-player">
                          <IconButton size="small" color="primary" onClick={() => loadVideo(v)}>
                            <PlayCircleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(v)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setDeleteTarget(v)}>
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
        <DialogTitle>{editingVideo ? "Edit Video" : "Add Focus Video"}</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="YouTube URL"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              required
              fullWidth
              placeholder="https://www.youtube.com/watch?v=..."
              helperText="Paste any YouTube video or stream URL"
            />
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              fullWidth
              placeholder="e.g. 2-hour lofi stream, great for deep focus"
            />
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.title.trim() || !form.url.trim()}>
            {saving ? <CircularProgress size={20} color="inherit" /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Remove Video</DialogTitle>
        <DialogContent>
          <Typography>
            Remove <strong>{deleteTarget?.title}</strong> from your library? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Remove</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
