import { useState, useEffect, useRef } from "react";
import {
  Alert,
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
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
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
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  uploadDocument,
  deleteDocumentFile,
} from "../services/documentService";
import { useNotify } from "../context/NotificationContext";
import { supabase } from "../supabaseClient";

const BUCKET = "documents";

const TYPE_OPTIONS = [
  { value: "resume", label: "Resume" },
  { value: "cover_letter", label: "Cover Letter" },
  { value: "other", label: "Other" },
];

function typeLabel(type) {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

function typeColor(type) {
  switch (type) {
    case "resume": return "primary";
    case "cover_letter": return "info";
    default: return "default";
  }
}

function getPublicUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export default function Documents() {
  const notify = useNotify();
  const fileInputRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [form, setForm] = useState({ name: "", type: "resume", is_base: false });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => { loadDocuments(); }, []);

  async function loadDocuments() {
    setLoading(true);
    try {
      setDocuments(await getDocuments());
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function openAddDialog() {
    setEditingDocument(null);
    setForm({ name: "", type: "resume", is_base: false });
    setSelectedFile(null);
    setDialogOpen(true);
  }

  function openEditDialog(doc) {
    setEditingDocument(doc);
    setForm({ name: doc.name ?? "", type: doc.type ?? "resume", is_base: doc.is_base ?? false });
    setSelectedFile(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingDocument(null);
    setForm({ name: "", type: "resume", is_base: false });
    setSelectedFile(null);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    // Auto-fill name from filename if empty
    if (!form.name) {
      setForm((f) => ({ ...f, name: file.name.replace(/\.[^.]+$/, "") }));
    }
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setUploading(false);
    let uploadedPath = null;

    try {
      let filePath = editingDocument?.file_path ?? null;

      if (selectedFile) {
        setUploading(true);
        const result = await uploadDocument(selectedFile);
        uploadedPath = result.path;
        filePath = result.path;
        setUploading(false);
      }

      const payload = {
        name: form.name.trim(),
        type: form.type,
        is_base: form.is_base,
        file_path: filePath,
      };

      try {
        if (editingDocument) {
          const updated = await updateDocument(editingDocument.id, payload);
          setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        } else {
          const created = await createDocument(payload, notify);
          setDocuments((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        }
        notify("Document saved! 📄", "success");
        closeDialog();
      } catch (dbErr) {
        // If DB insert failed but we uploaded a file, clean it up
        if (uploadedPath) {
          await deleteDocumentFile(uploadedPath).catch(console.error);
        }
        throw dbErr;
      }
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      // Delete file from storage if it exists
      if (deleteTarget.file_path) {
        await deleteDocumentFile(deleteTarget.file_path).catch(console.error);
      }
      await deleteDocument(deleteTarget.id);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      notify("Document deleted.", "success");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  const isPdf = (doc) => doc?.file_path?.toLowerCase().endsWith(".pdf");

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Documents</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>
          Add Document
        </Button>
      </Stack>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}><CircularProgress /></Box>
          ) : documents.length === 0 ? (
            <Box sx={{ textAlign: "center", p: 6 }}>
              <Typography color="text.secondary">No documents yet — upload your resume to get started! 📄</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Base</TableCell>
                    <TableCell>File</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.map((doc) => {
                    const publicUrl = getPublicUrl(doc.file_path);
                    return (
                      <TableRow key={doc.id} hover>
                        <TableCell><Typography fontWeight="medium">{doc.name}</Typography></TableCell>
                        <TableCell>
                          {doc.type ? <Chip label={typeLabel(doc.type)} size="small" color={typeColor(doc.type)} /> : "—"}
                        </TableCell>
                        <TableCell>
                          {doc.is_base ? <Chip label="Base" size="small" color="success" /> : "—"}
                        </TableCell>
                        <TableCell>
                          {publicUrl ? (
                            <Stack direction="row" spacing={0.5}>
                              {isPdf(doc) && (
                                <Tooltip title="Preview">
                                  <IconButton size="small" onClick={() => setPreviewDoc(doc)}>
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Download">
                                <IconButton size="small" component="a" href={publicUrl} download>
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.disabled">No file</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEditDialog(doc)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => setDeleteTarget(doc)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingDocument ? "Edit Document" : "Add Document"}</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {/* File upload */}
            <Box>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <Button
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
              >
                {selectedFile ? selectedFile.name : editingDocument?.file_path ? "Replace file" : "Upload PDF or DOCX"}
              </Button>
              {selectedFile && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, textAlign: "center" }}>
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                </Typography>
              )}
              {editingDocument?.file_path && !selectedFile && (
                <Typography variant="caption" color="success.main" display="block" sx={{ mt: 0.5, textAlign: "center" }}>
                  ✓ File already uploaded
                </Typography>
              )}
            </Box>

            {uploading && (
              <Box>
                <Typography variant="caption" color="text.secondary">Uploading...</Typography>
                <LinearProgress sx={{ mt: 0.5 }} />
              </Box>
            )}

            <TextField
              label="Document Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              fullWidth
              autoFocus
              placeholder='e.g. "Software Engineer Resume v2"'
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={form.type} label="Type" onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {TYPE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControlLabel
              label="Base document (master/canonical version)"
              control={<Switch checked={form.is_base} onChange={(e) => setForm((f) => ({ ...f, is_base: e.target.checked }))} />}
            />
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? <CircularProgress size={20} color="inherit" /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewDoc} onClose={() => setPreviewDoc(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            {previewDoc?.name}
            <IconButton onClick={() => setPreviewDoc(null)}><DeleteIcon /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: "75vh" }}>
          {previewDoc && (
            <iframe
              src={getPublicUrl(previewDoc.file_path)}
              title={previewDoc.name}
              width="100%"
              height="100%"
              style={{ border: "none" }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Document</DialogTitle>
        <DialogContent>
          <Typography>
            Delete <strong>{deleteTarget?.name}</strong>?
            {deleteTarget?.file_path && " This will also remove the uploaded file."}
            {" "}This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
