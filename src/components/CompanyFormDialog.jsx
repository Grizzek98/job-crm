import { useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  Stack,
  TextField,
} from "@mui/material";
import { createCompany, updateCompany } from "../services/companyService";
import { useNotify } from "../context/NotificationContext";
import { normalizeUrl } from "../utils/url";

// Shared Add/Edit dialog for companies — used by both the Companies data page
// and the CRM's Companies section so the form lives in exactly one place.
// Mount only while open (parent conditionally renders it); it seeds its form
// from `company` on mount. Props: company (null = add), onClose(),
// onSaved(saved, isNew).

const emptyForm = { name: "", size: "", url: "", glassdoor_rating: "", notes: "" };

function fromEntity(c) {
  return {
    name: c.name ?? "",
    size: c.size ?? "",
    url: c.url ?? "",
    glassdoor_rating: c.glassdoor_rating ?? "",
    notes: c.notes ?? "",
  };
}

export default function CompanyFormDialog({ company, onClose, onSaved }) {
  const notify = useNotify();
  const [form, setForm] = useState(() => (company ? fromEntity(company) : emptyForm));
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
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
        glassdoor_rating: form.glassdoor_rating ? parseFloat(form.glassdoor_rating) : null,
        notes: form.notes.trim() || null,
      };
      const saved = company
        ? await updateCompany(company.id, payload)
        : await createCompany(payload, notify);
      onSaved?.(saved, !company);
      onClose?.();
    } catch (err) {
      notify(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{company ? "Edit Company" : "Add Company"}</DialogTitle>
      <Divider />
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Company Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            fullWidth
            autoFocus
          />
          <TextField
            label="Number of Employees"
            name="size"
            value={form.size}
            onChange={handleChange}
            type="number"
            fullWidth
          />
          <TextField
            label="Website URL"
            name="url"
            value={form.url}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Glassdoor Rating"
            name="glassdoor_rating"
            value={form.glassdoor_rating}
            onChange={handleChange}
            type="number"
            slotProps={{ htmlInput: { min: 0, max: 5, step: 0.1 }, input: { endAdornment: <InputAdornment position="end">/ 5</InputAdornment> } }}
            fullWidth
          />
          <TextField
            label="Notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            multiline
            minRows={3}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim()}>
          {saving ? <CircularProgress size={20} color="inherit" /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
