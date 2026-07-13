import { useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import { createContact, updateContact } from "../services/contactService";
import { useNotify } from "../context/NotificationContext";
import { normalizeUrl } from "../utils/url";

// Shared Add/Edit dialog for contacts — used by both the Contacts data page and
// the CRM's Contacts section. Mount only while open; seeds from `contact` on
// mount. Props: contact (null = add), companies (for the dropdown), onClose(),
// onSaved(saved, isNew).

const emptyForm = {
  company_id: "",
  name: "",
  title: "",
  email: "",
  phone: "",
  linkedin_url: "",
  notes: "",
};

function fromEntity(c) {
  return {
    company_id: c.company_id ?? "",
    name: c.name ?? "",
    title: c.title ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    linkedin_url: c.linkedin_url ?? "",
    notes: c.notes ?? "",
  };
}

export default function ContactFormDialog({ contact, companies = [], onClose, onSaved }) {
  const notify = useNotify();
  const [form, setForm] = useState(() => (contact ? fromEntity(contact) : emptyForm));
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        company_id: form.company_id || null,
        name: form.name.trim(),
        title: form.title.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        linkedin_url: normalizeUrl(form.linkedin_url.trim()) || null,
        notes: form.notes.trim() || null,
      };
      const saved = contact
        ? await updateContact(contact.id, payload)
        : await createContact(payload, notify);
      onSaved?.(saved, !contact);
      onClose?.();
    } catch (err) {
      notify(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{contact ? "Edit Contact" : "Add Contact"}</DialogTitle>
      <Divider />
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            fullWidth
            autoFocus
          />
          <FormControl fullWidth>
            <InputLabel>Company</InputLabel>
            <Select name="company_id" value={form.company_id} label="Company" onChange={handleChange}>
              <MenuItem value=""><em>None</em></MenuItem>
              {companies.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Title" name="title" value={form.title} onChange={handleChange} fullWidth />
          <TextField label="Email" name="email" value={form.email} onChange={handleChange} type="email" fullWidth />
          <TextField label="Phone" name="phone" value={form.phone} onChange={handleChange} fullWidth />
          <TextField label="LinkedIn URL" name="linkedin_url" value={form.linkedin_url} onChange={handleChange} fullWidth />
          <TextField label="Notes" name="notes" value={form.notes} onChange={handleChange} multiline minRows={3} fullWidth />
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
