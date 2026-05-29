import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { parseJobText } from "../services/scraperService";
import { getCompanies, createCompany } from "../services/companyService";
import { createPosition } from "../services/positionService";
import { useNotify } from "../context/NotificationContext";
import { normalizeUrl } from "../utils/url";

// 'applied' is intentionally excluded — it's set automatically when an application is created
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "applying", label: "Applying" },
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
  company_name: "",
  company_id: null, // null = create new, string = existing ID
  position_name: "",
  status: "active",
  type: "",
  location: "",
  pay_min: "",
  pay_max: "",
  pay_type: "",
  description: "",
  requirements: "",
  benefits: "",
  travel_requirements: "",
  notes: "",
  url_listing: "",
  url_application: "",
  posted_at: null,
};

export default function AddJob() {
  const notify = useNotify();
  const navigate = useNavigate();

  const [pastedText, setPastedText] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scraped, setScraped] = useState(null); // raw scraped data
  const [scrapeError, setScrapeError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [companies, setCompanies] = useState([]);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadCompanies() {
    if (companiesLoaded) return;
    try {
      setCompanies(await getCompanies());
      setCompaniesLoaded(true);
    } catch {
      // Non-fatal
    }
  }

  async function handleParseText() {
    if (!pastedText.trim()) return;
    setScraping(true);
    setScrapeError(null);
    setScraped(null);
    await loadCompanies();
    try {
      const data = await parseJobText(pastedText.trim());
      setScraped(data);
      const matchedCompany = companies.find(
        (c) => c.name.toLowerCase() === (data.company_name ?? "").toLowerCase(),
      );
      setForm({
        company_name: data.company_name ?? "",
        company_id: matchedCompany?.id ?? null,
        position_name: data.position_name ?? "",
        status: "active",
        type: data.position_type ?? "",
        location: data.location ?? "",
        pay_min: data.pay_min ?? "",
        pay_max: data.pay_max ?? "",
        pay_type: data.pay_type ?? "",
        description: data.description ?? "",
        requirements: data.requirements ?? "",
        benefits: data.benefits ?? "",
        travel_requirements: data.travel_requirements ?? "",
        notes: "",
        url_listing: "",
        url_application: "",
        posted_at: data.posted_at ? dayjs(data.posted_at) : null,
      });
    } catch (err) {
      setScrapeError(err.message ?? "Parsing failed. You can fill in the form manually.");
      await loadCompanies();
    } finally {
      setScraping(false);
    }
  }

  function handleManual() {
    setScrapeError(null);
    loadCompanies();
  }

  function clear() {
    setPastedText("");
    setScraped(null);
    setScrapeError(null);
    setForm(emptyForm);
  }

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSave() {
    if (!form.position_name.trim()) {
      notify("Position name is required.", "error");
      return;
    }
    setSaving(true);
    try {
      let companyId = form.company_id;

      // Create company if new
      if (!companyId && form.company_name.trim()) {
        const newCo = await createCompany(
          { name: form.company_name.trim(), url: normalizeUrl(scraped?.company_url ?? "") || null },
          notify,
        );
        companyId = newCo.id;
      }

      const posPayload = {
        company_id: companyId || null,
        name: form.position_name.trim(),
        status: form.status,
        type: form.type || null,
        location: form.location.trim() || null,
        pay_min: form.pay_min !== "" ? parseFloat(form.pay_min) : null,
        pay_max: form.pay_max !== "" ? parseFloat(form.pay_max) : null,
        pay_type: form.pay_type || null,
        description: form.description.trim() || null,
        requirements: form.requirements.trim() || null,
        benefits: form.benefits.trim() || null,
        travel_requirements: form.travel_requirements.trim() || null,
        notes: form.notes.trim() || null,
        url_listing: normalizeUrl(form.url_listing.trim()) || null,
        url_application: normalizeUrl(form.url_application.trim()) || null,
        posted_at: form.posted_at?.toISOString() ?? null,
      };

      await createPosition(posPayload, notify, !!scraped);
      notify("Position saved! 🎉", "success");
      navigate("/crm");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const showForm = scraped !== null || scrapeError !== null;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight="bold">Add Job</Typography>
            <Typography variant="body2" color="text.secondary">
              Copy a job listing from LinkedIn, Indeed, or anywhere else and paste it below — we'll pull out what we can 🤖
            </Typography>
          </Box>
          {showForm && (
            <Button variant="outlined" onClick={clear}>Clear</Button>
          )}
        </Stack>

        {/* Input card — paste text */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <TextField
                fullWidth
                multiline
                rows={10}
                label="Paste job description"
                placeholder={"Full job description\n\nJoin the Acme Corp team…"}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
              <Button
                variant="contained"
                onClick={handleParseText}
                disabled={scraping || !pastedText.trim()}
                sx={{ alignSelf: "flex-start", minWidth: 140 }}
              >
                {scraping ? <CircularProgress size={20} color="inherit" /> : "Parse Text"}
              </Button>
            </Stack>
            {scraping && <LinearProgress sx={{ mt: 2 }} />}
          </CardContent>
        </Card>

        {scrapeError && (
          <Alert severity="warning" sx={{ mb: 3 }} action={
            <Button color="inherit" size="small" onClick={handleManual}>Fill manually</Button>
          }>
            {scrapeError}
          </Alert>
        )}

        {showForm && (
          <Grid container spacing={3}>
            {/* Scraped preview */}
            {scraped && (
              <Grid size={{ xs: 12, md: 5 }}>
                <Card sx={{ height: "100%", bgcolor: "grey.50" }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      📋 Scraped Data
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                      Review what we found — edit the form on the right if anything looks off.
                    </Typography>
                    <Stack spacing={1}>
                      {Object.entries(scraped).map(([k, v]) => v != null && (
                        <Box key={k}>
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>
                            {k.replace(/_/g, " ")}
                          </Typography>
                          <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                            {String(v)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Review form */}
            <Grid size={{ xs: 12, md: scraped ? 7 : 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    ✏️ Review & Save
                  </Typography>
                  <Stack spacing={2}>
                    <Autocomplete
                      freeSolo
                      options={companies}
                      getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
                      value={form.company_name || null}
                      onInputChange={(_, val) => {
                        setField("company_name", val);
                        setField("company_id", null);
                      }}
                      onChange={(_, val) => {
                        if (val && typeof val === "object") {
                          setField("company_name", val.name);
                          setField("company_id", val.id);
                        } else if (typeof val === "string") {
                          setField("company_name", val);
                          setField("company_id", null);
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Company"
                          helperText={
                            form.company_id
                              ? "✓ Matched existing company"
                              : form.company_name
                              ? "Will create a new company"
                              : "Start typing to match existing companies"
                          }
                        />
                      )}
                    />

                    <TextField
                      label="Position Title"
                      value={form.position_name}
                      onChange={(e) => setField("position_name", e.target.value)}
                      required
                      fullWidth
                    />

                    <Stack direction="row" spacing={2}>
                      <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select value={form.status} label="Status" onChange={(e) => setField("status", e.target.value)}>
                          {STATUS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <FormControl fullWidth>
                        <InputLabel>Type</InputLabel>
                        <Select value={form.type} label="Type" onChange={(e) => setField("type", e.target.value)}>
                          <MenuItem value=""><em>Unknown</em></MenuItem>
                          {TYPE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Stack>

                    <TextField label="Location" value={form.location} onChange={(e) => setField("location", e.target.value)} fullWidth />

                    <Stack direction="row" spacing={2}>
                      <TextField
                        label="Pay Min"
                        type="number"
                        value={form.pay_min}
                        onChange={(e) => setField("pay_min", e.target.value)}
                        slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                        fullWidth
                      />
                      <TextField
                        label="Pay Max"
                        type="number"
                        value={form.pay_max}
                        onChange={(e) => setField("pay_max", e.target.value)}
                        slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                        fullWidth
                      />
                      <FormControl fullWidth>
                        <InputLabel>Pay Type</InputLabel>
                        <Select value={form.pay_type} label="Pay Type" onChange={(e) => setField("pay_type", e.target.value)}>
                          <MenuItem value=""><em>—</em></MenuItem>
                          {PAY_TYPE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Stack>

                    <DatePicker
                      label="Posted Date"
                      value={form.posted_at}
                      onChange={(val) => setField("posted_at", val)}
                      slotProps={{ textField: { fullWidth: true } }}
                    />

                    <TextField label="Description" value={form.description} onChange={(e) => setField("description", e.target.value)} multiline minRows={4} fullWidth />
                    <TextField label="Requirements" value={form.requirements} onChange={(e) => setField("requirements", e.target.value)} multiline minRows={3} fullWidth />
                    <TextField label="Benefits" value={form.benefits} onChange={(e) => setField("benefits", e.target.value)} multiline minRows={2} fullWidth />
                    <TextField label="Travel Requirements" value={form.travel_requirements} onChange={(e) => setField("travel_requirements", e.target.value)} fullWidth />
                    <TextField label="Listing URL" value={form.url_listing} onChange={(e) => setField("url_listing", e.target.value)} fullWidth />
                    <TextField label="Application Portal URL" value={form.url_application} onChange={(e) => setField("url_application", e.target.value)} fullWidth />
                    <TextField label="Notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} multiline minRows={2} fullWidth />

                    <Divider />
                    <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
                      <Button onClick={clear} disabled={saving}>Clear</Button>
                      <Button variant="contained" onClick={handleSave} disabled={saving || !form.position_name.trim()}>
                        {saving ? <CircularProgress size={20} color="inherit" /> : "Save Position"}
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {!showForm && !scraping && (
          <Card>
            <CardContent sx={{ textAlign: "center", py: 6 }}>
              <Typography variant="h6" gutterBottom>Ready to add a job?</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Copy the full job listing from LinkedIn, Indeed, or any job board and paste it above. We'll extract company, title, location, pay, and more — then you review and save. You've got this! 💪
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>
    </LocalizationProvider>
  );
}
