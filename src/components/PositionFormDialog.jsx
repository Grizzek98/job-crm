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
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { createPosition, updatePosition } from "../services/positionService";
import { useNotify } from "../context/NotificationContext";
import { normalizeUrl } from "../utils/url";

// Shared Add/Edit dialog for positions — used by both the Positions data page
// and the CRM's Positions section. Mount only while open; seeds from `position`
// on mount. Props: position (null = add), companies (for the dropdown),
// onClose(), onSaved(saved, isNew).

// `applied` is also auto-set when an application record is created, but it's
// selectable manually too so the user can mark/restore it themselves (e.g. after
// reverting from "Not Interested"). Manual `applied` does not require an
// application record to exist.
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
  requirements: "",
  benefits: "",
  travel_requirements: "",
  notes: "",
  posted_at: null,
};

function fromEntity(p) {
  return {
    company_id: p.company_id ?? "",
    name: p.name ?? "",
    status: p.status ?? "active",
    type: p.type ?? "",
    location: p.location ?? "",
    pay_min: p.pay_min ?? "",
    pay_max: p.pay_max ?? "",
    pay_type: p.pay_type ?? "",
    url_listing: p.url_listing ?? "",
    url_application: p.url_application ?? "",
    description: p.description ?? "",
    requirements: p.requirements ?? "",
    benefits: p.benefits ?? "",
    travel_requirements: p.travel_requirements ?? "",
    notes: p.notes ?? "",
    posted_at: p.posted_at ? dayjs(p.posted_at) : null,
  };
}

export default function PositionFormDialog({ position, companies = [], onClose, onSaved }) {
  const notify = useNotify();
  const [form, setForm] = useState(() => (position ? fromEntity(position) : emptyForm));
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
        status: form.status || "active",
        type: form.type || null,
        location: form.location.trim() || null,
        pay_min: form.pay_min !== "" ? parseFloat(form.pay_min) : null,
        pay_max: form.pay_max !== "" ? parseFloat(form.pay_max) : null,
        pay_type: form.pay_type || null,
        url_listing: normalizeUrl(form.url_listing.trim()) || null,
        url_application: normalizeUrl(form.url_application.trim()) || null,
        description: form.description.trim() || null,
        requirements: form.requirements.trim() || null,
        benefits: form.benefits.trim() || null,
        travel_requirements: form.travel_requirements.trim() || null,
        notes: form.notes.trim() || null,
        posted_at: form.posted_at?.toISOString() ?? null,
      };

      let saved;
      if (position) {
        saved = await updatePosition(position.id, payload, notify, position.status);
      } else {
        saved = await createPosition(payload, notify);
      }
      notify("Position saved!", "success");
      onSaved?.(saved, !position);
      onClose?.();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{position ? "Edit Position" : "Add Position"}</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Job Title"
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
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select name="status" value={form.status} label="Status" onChange={handleChange}>
                {STATUS_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select name="type" value={form.type} label="Type" onChange={handleChange}>
                <MenuItem value=""><em>None</em></MenuItem>
                {TYPE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Location" name="location" value={form.location} onChange={handleChange} fullWidth />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Pay Min"
                name="pay_min"
                value={form.pay_min}
                onChange={handleChange}
                type="number"
                slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                fullWidth
              />
              <TextField
                label="Pay Max"
                name="pay_max"
                value={form.pay_max}
                onChange={handleChange}
                type="number"
                slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                fullWidth
              />
            </Stack>
            <FormControl fullWidth>
              <InputLabel>Pay Type</InputLabel>
              <Select name="pay_type" value={form.pay_type} label="Pay Type" onChange={handleChange}>
                <MenuItem value=""><em>None</em></MenuItem>
                {PAY_TYPE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Listing URL" name="url_listing" value={form.url_listing} onChange={handleChange} fullWidth />
            <TextField label="Application URL" name="url_application" value={form.url_application} onChange={handleChange} fullWidth />
            <TextField label="Description" name="description" value={form.description} onChange={handleChange} multiline minRows={3} fullWidth />
            <TextField
              label="Requirements"
              name="requirements"
              value={form.requirements}
              onChange={handleChange}
              multiline
              minRows={3}
              fullWidth
              placeholder="Education, experience, skills required..."
            />
            <TextField
              label="Benefits"
              name="benefits"
              value={form.benefits}
              onChange={handleChange}
              multiline
              minRows={2}
              fullWidth
              placeholder="Health, 401k, PTO..."
            />
            <TextField
              label="Travel Requirements"
              name="travel_requirements"
              value={form.travel_requirements}
              onChange={handleChange}
              multiline
              minRows={1}
              fullWidth
              placeholder="e.g. Up to 25% travel"
            />
            <DatePicker
              label="Posted Date"
              value={form.posted_at}
              onChange={(val) => setForm((f) => ({ ...f, posted_at: val }))}
              slotProps={{ textField: { fullWidth: true } }}
            />
            <TextField label="Notes" name="notes" value={form.notes} onChange={handleChange} multiline minRows={2} fullWidth />
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
    </LocalizationProvider>
  );
}
