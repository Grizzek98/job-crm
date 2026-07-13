import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Popover,
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
import {
  Timeline as MuiTimeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from "@mui/lab";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import ArticleIcon from "@mui/icons-material/Article";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import StickyNote2Icon from "@mui/icons-material/StickyNote2";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { getApplications, createApplication, updateApplication, deleteApplication } from "../services/applicationService";
import { getCompanies } from "../services/companyService";
import { getPositions } from "../services/positionService";
import { getContacts } from "../services/contactService";
import { getDocuments } from "../services/documentService";
import { getEventsByApplication } from "../services/eventService";
import { useNotify } from "../context/NotificationContext";
import CompanyFormDialog from "../components/CompanyFormDialog";
import PositionFormDialog from "../components/PositionFormDialog";
import ContactFormDialog from "../components/ContactFormDialog";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APP_STATUS_OPTIONS = [
  { value: "applied", label: "Applied", color: "primary" },
  { value: "interviewing", label: "Interviewing", color: "secondary" },
  { value: "offered", label: "Offered", color: "success" },
  { value: "accepted", label: "Accepted", color: "success" },
  { value: "declined", label: "Declined", color: "warning" },
  { value: "rejected", label: "Rejected", color: "error" },
  { value: "withdrawn", label: "Withdrawn", color: "default" },
  { value: "ghosted", label: "Ghosted", color: "default" },
];

const POS_STATUS_LABELS = {
  active: "Active", applying: "Applying", applied: "Applied",
  not_interested: "Not Interested", closed: "Closed",
};

const EVENT_TYPE_META = {
  interview: { label: "Interview", color: "primary" },
  offer: { label: "Offer", color: "success" },
  rejection: { label: "Rejection", color: "error" },
  follow_up: { label: "Follow Up", color: "warning" },
  chat: { label: "Chat", color: "info" },
  other: { label: "Other", color: "default" },
  entity_created: { label: "Created", color: "default" },
  discovered: { label: "Discovered", color: "secondary" },
  status_change: { label: "Status Change", color: "info" },
};

const SECTION_KEYS = ["companies", "positions", "contacts", "applications"];

const SECTION_LABELS = {
  companies: "Companies",
  positions: "Positions",
  contacts: "Contacts",
  applications: "Applications",
};

// Column definitions per section — `key` is used both as the visibility toggle
// id and (where sortable) as the sort field. Order here = display order.
const SECTION_COLUMNS = {
  companies: [
    { key: "name", label: "Name" },
    { key: "glassdoor_rating", label: "Glassdoor" },
    { key: "size", label: "Size" },
    { key: "url", label: "Website" },
    { key: "notes", label: "Notes" },
    { key: "actions", label: "Actions" },
  ],
  positions: [
    { key: "company", label: "Company" },
    { key: "name", label: "Title" },
    { key: "status", label: "Status" },
    { key: "pay", label: "Pay" },
    { key: "location", label: "Location" },
    { key: "type", label: "Type" },
    { key: "created_at", label: "Added" },
    { key: "notes", label: "Notes" },
    { key: "action", label: "Action" },
  ],
  contacts: [
    { key: "name", label: "Name" },
    { key: "company", label: "Company" },
    { key: "title", label: "Title" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "notes", label: "Notes" },
    { key: "actions", label: "Actions" },
  ],
  applications: [
    { key: "company", label: "Company" },
    { key: "position", label: "Position" },
    { key: "status", label: "Status" },
    { key: "applied_date", label: "Applied" },
    { key: "pay", label: "Pay" },
    { key: "docs", label: "Docs" },
    { key: "actions", label: "Actions" },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function appStatusChip(status) {
  const s = APP_STATUS_OPTIONS.find((o) => o.value === status);
  return <Chip label={s?.label ?? status} size="small" color={s?.color ?? "default"} />;
}

function posStatusChip(status) {
  const colors = { active: "primary", applying: "info", applied: "info", closed: "error", not_interested: "default" };
  return (
    <Chip
      label={POS_STATUS_LABELS[status] ?? status}
      size="small"
      color={colors[status] ?? "default"}
    />
  );
}

// Milestone row markers — shown whenever the milestone exists on the (linked)
// application, regardless of current status. The first_*_at columns are set-once
// and never cleared (see applicationService), so these persist even after the
// status moves on (e.g. a now-rejected app that once got an offer still shows
// the trophy). `app` may be undefined (a position with no linked application).
function showsInterviewMarker(app) {
  return !!app?.first_interview_at;
}
function showsOfferMarker(app) {
  return !!app?.first_offer_at;
}

function formatPay(payMin, payMax, payType) {
  if (!payMin && !payMax) return "—";
  const fmt = (n) => `$${Number(n).toLocaleString()}`;
  // Zero-width space after the dash gives the browser a clean break point so
  // the range can stack min-over-max when the column is squished.
  const range = [payMin && fmt(payMin), payMax && fmt(payMax)].filter(Boolean).join("–​");
  const suffix = payType === "hourly" ? "/hr" : payType === "salary" ? "/yr" : "";
  return range + suffix;
}

function glassdoorColor(rating) {
  if (!rating) return "default";
  if (rating >= 4.0) return "success";
  if (rating >= 3.0) return "warning";
  return "error";
}

// Generic sort: returns sorted copy of rows
function sortRows(rows, sort, getVal) {
  if (!sort.field) return rows;
  return [...rows].sort((a, b) => {
    const av = getVal(a, sort.field) ?? "";
    const bv = getVal(b, sort.field) ?? "";
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

// Load or default active sections from localStorage
function loadSavedSections() {
  try {
    const saved = localStorage.getItem("crm_sections");
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return SECTION_KEYS;
}

// Default column visibility: every column visible in every section
function defaultColVis() {
  return Object.fromEntries(
    SECTION_KEYS.map((s) => [s, SECTION_COLUMNS[s].map((c) => c.key)]),
  );
}

// Load column visibility from localStorage, merged with defaults so newly
// added columns default to visible even if an older preference is stored.
function loadColVis() {
  const base = defaultColVis();
  try {
    const saved = JSON.parse(localStorage.getItem("crm_columns") ?? "null");
    if (saved && typeof saved === "object") {
      for (const s of SECTION_KEYS) {
        if (Array.isArray(saved[s])) {
          // Keep the saved choices for columns that still exist...
          const savedValid = saved[s].filter((k) =>
            SECTION_COLUMNS[s].some((c) => c.key === k),
          );
          // ...and append any columns added since this preference was saved
          // (e.g. a new "actions" column) so they default to visible instead
          // of silently disappearing for existing users.
          const newCols = SECTION_COLUMNS[s]
            .map((c) => c.key)
            .filter((k) => !saved[s].includes(k));
          base[s] = [...savedValid, ...newCols];
        }
      }
    }
  } catch { /* ignore */ }
  return base;
}

// ---------------------------------------------------------------------------
// SortableHeader
// ---------------------------------------------------------------------------

function SortableHeader({ label, field, sort, onSort, align = "left", width }) {
  const active = sort.field === field;
  return (
    <TableCell
      align={align}
      onClick={() => onSort(field)}
      sx={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", width }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
        <span>{label}</span>
        {active
          ? sort.dir === "asc"
            ? <ArrowUpwardIcon sx={{ fontSize: 14 }} />
            : <ArrowDownwardIcon sx={{ fontSize: 14 }} />
          : <UnfoldMoreIcon sx={{ fontSize: 14, opacity: 0.3 }} />}
      </Stack>
    </TableCell>
  );
}

// ---------------------------------------------------------------------------
// ColumnMenu — per-section "Columns" button + checkbox popover
// ---------------------------------------------------------------------------

function ColumnMenu({ columns, visible, onToggle }) {
  const [anchor, setAnchor] = useState(null);
  const lastVisible = visible.length <= 1; // don't let the user hide every column
  return (
    <>
      <Button
        size="small"
        startIcon={<ViewColumnIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ textTransform: "none", color: "text.secondary" }}
      >
        Columns
      </Button>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <FormGroup sx={{ p: 1, minWidth: 160 }}>
          {columns.map((col) => {
            const checked = visible.includes(col.key);
            return (
              <FormControlLabel
                key={col.key}
                sx={{ m: 0 }}
                control={
                  <Checkbox
                    size="small"
                    checked={checked}
                    disabled={checked && lastVisible}
                    onChange={() => onToggle(col.key)}
                  />
                }
                label={col.label}
              />
            );
          })}
        </FormGroup>
      </Popover>
    </>
  );
}

// ---------------------------------------------------------------------------
// NoteCell — icon shown only when a note exists; click opens a read-only popover
// with the full note text. Lets you view entity notes from the CRM without
// opening the edit form or visiting the data pages.
// ---------------------------------------------------------------------------

function NoteCell({ note }) {
  const [anchor, setAnchor] = useState(null);
  if (!note) return null;
  return (
    <>
      <Tooltip title="View note">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
        >
          <StickyNote2Icon fontSize="small" sx={{ color: "text.secondary" }} />
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Box sx={{ p: 1.5, maxWidth: 340, maxHeight: 320, overflow: "auto" }}>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {note}
          </Typography>
        </Box>
      </Popover>
    </>
  );
}

// ---------------------------------------------------------------------------
// Application form defaults
// ---------------------------------------------------------------------------

const emptyAppForm = {
  position_id: "",
  status: "applied",
  applied_date: dayjs().format("YYYY-MM-DD"),
  resume_id: "",
  cover_letter_id: "",
  notes: "",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Crm() {
  const notify = useNotify();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [companies, setCompanies] = useState([]);
  const [positions, setPositions] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [applications, setApplications] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Filter / search ───────────────────────────────────────────────────────
  const [activeSections, setActiveSections] = useState(() => {
    const sectionParam = new URLSearchParams(window.location.search).get("section");
    if (sectionParam && SECTION_KEYS.includes(sectionParam)) return [sectionParam];
    return loadSavedSections();
  });
  // Pre-fill search from ?search= URL param (set by sidebar global search)
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get("search") ?? "");

  // ── Per-section column visibility ─────────────────────────────────────────
  const [colVis, setColVis] = useState(loadColVis);

  // ── Inline edit dialog (shared with the data pages) — { type, entity } ─────
  const [edit, setEdit] = useState(null);

  // ── Per-section sort ──────────────────────────────────────────────────────
  const [coSort, setCoSort] = useState({ field: "name", dir: "asc" });
  const [posSort, setPosSort] = useState({ field: "name", dir: "asc" });
  const [ctSort, setCtSort] = useState({ field: "name", dir: "asc" });
  const [appSort, setAppSort] = useState({ field: "applied_date", dir: "desc" });

  // ── Application dialog (add / edit) ───────────────────────────────────────
  const [appDialogOpen, setAppDialogOpen] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [appForm, setAppForm] = useState(emptyAppForm);
  const [saving, setSaving] = useState(false);

  // ── Delete confirm ────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Application detail drawer ─────────────────────────────────────────────
  const [drawerApp, setDrawerApp] = useState(null);
  const [drawerEvents, setDrawerEvents] = useState([]);
  const [drawerEventsLoading, setDrawerEventsLoading] = useState(false);

  // ── Load all data ─────────────────────────────────────────────────────────
  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [cos, pos, cts, apps, docs] = await Promise.all([
        getCompanies(),
        getPositions(),
        getContacts(),
        getApplications(),
        getDocuments(),
      ]);
      setCompanies(cos);
      setPositions(pos);
      setContacts(cts);
      setApplications(apps);
      setDocuments(docs);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // ── Handle ?apply=POSITION_ID and ?search= from URL ─────────────────────
  useEffect(() => {
    const applyId = searchParams.get("apply");
    if (!applyId || loading) return;
    const pos = positions.find((p) => p.id === applyId);
    if (pos) {
      openApply(pos);
      setSearchParams({}, { replace: true });
    }
  }, [loading, searchParams, positions]);

  // Clear ?search= and ?section= from URL on mount (state seeded synchronously in useState initializers)
  useEffect(() => {
    if (searchParams.get("search") || searchParams.get("section")) {
      setSearchParams((prev) => { prev.delete("search"); prev.delete("section"); return prev; }, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Section filter chip toggle ────────────────────────────────────────────
  function toggleSection(key) {
    setActiveSections((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem("crm_sections", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  function toggleColumn(section, colKey) {
    setColVis((prev) => {
      const current = prev[section];
      const isVisible = current.includes(colKey);
      // Guard: never allow hiding the last remaining column
      if (isVisible && current.length <= 1) return prev;
      // Rebuild in canonical column order so display order stays stable
      const nextVisible = SECTION_COLUMNS[section]
        .map((c) => c.key)
        .filter((k) => (k === colKey ? !isVisible : current.includes(k)));
      const next = { ...prev, [section]: nextVisible };
      try { localStorage.setItem("crm_columns", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  // ── Sort helpers ──────────────────────────────────────────────────────────
  function makeSortHandler(setSort) {
    return (field) =>
      setSort((prev) => ({
        field,
        dir: prev.field === field && prev.dir === "asc" ? "desc" : "asc",
      }));
  }

  // ── Search filter ─────────────────────────────────────────────────────────
  const q = search.toLowerCase().trim();

  const filteredCompanies = q
    ? companies.filter((c) =>
        c.name?.toLowerCase().includes(q) || c.notes?.toLowerCase().includes(q)
      )
    : companies;

  const filteredPositions = q
    ? positions.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.companies?.name?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q)
      )
    : positions;

  const filteredContacts = q
    ? contacts.filter((c) =>
        c.name?.toLowerCase().includes(q) ||
        c.companies?.name?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      )
    : contacts;

  const filteredApps = q
    ? applications.filter((a) =>
        a.positions?.name?.toLowerCase().includes(q) ||
        a.positions?.companies?.name?.toLowerCase().includes(q) ||
        a.status?.toLowerCase().includes(q)
      )
    : applications;

  // ── Map position_id → application (for Action button logic) ───────────────
  const appByPosition = Object.fromEntries(applications.map((a) => [a.position_id, a]));

  // ── Column visibility helpers ─────────────────────────────────────────────
  const showCo = (k) => colVis.companies.includes(k);
  const showPos = (k) => colVis.positions.includes(k);
  const showCt = (k) => colVis.contacts.includes(k);
  const showApp = (k) => colVis.applications.includes(k);

  // ── Sorted section rows ───────────────────────────────────────────────────
  const sortedCompanies = sortRows(filteredCompanies, coSort, (c, f) => {
    if (f === "glassdoor_rating") return c.glassdoor_rating;
    if (f === "size") return c.size;
    return c[f];
  });

  const sortedPositions = sortRows(filteredPositions, posSort, (p, f) => {
    if (f === "company") return p.companies?.name;
    if (f === "pay") return p.pay_min;
    if (f === "status") return p.status;
    return p[f];
  });

  const sortedContacts = sortRows(filteredContacts, ctSort, (c, f) => {
    if (f === "company") return c.companies?.name;
    return c[f];
  });

  const sortedApps = sortRows(filteredApps, appSort, (a, f) => {
    if (f === "company") return a.positions?.companies?.name;
    if (f === "position") return a.positions?.name;
    if (f === "pay") return a.positions?.pay_min;
    return a[f];
  });

  // ── Application dialog handlers ───────────────────────────────────────────
  function openApply(pos) {
    setEditingApp(null);
    setAppForm({ ...emptyAppForm, position_id: pos.id });
    setAppDialogOpen(true);
  }

  function openEdit(app, e) {
    if (e) e.stopPropagation();
    setEditingApp(app);
    setAppForm({
      position_id: app.position_id ?? "",
      status: app.status ?? "applied",
      applied_date: app.applied_date ?? dayjs().format("YYYY-MM-DD"),
      resume_id: app.resume_id ?? "",
      cover_letter_id: app.cover_letter_id ?? "",
      notes: app.notes ?? "",
    });
    setAppDialogOpen(true);
  }

  async function handleSaveApp() {
    if (!appForm.position_id) return;
    setSaving(true);
    try {
      const payload = {
        position_id: appForm.position_id,
        status: appForm.status,
        applied_date: appForm.applied_date || null,
        resume_id: appForm.resume_id || null,
        cover_letter_id: appForm.cover_letter_id || null,
        notes: appForm.notes.trim() || null,
      };
      if (editingApp) {
        const updated = await updateApplication(editingApp.id, payload, notify, editingApp.status);
        setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        const created = await createApplication(payload, notify);
        setApplications((prev) => [created, ...prev]);
        // Update positions list so the Action button refreshes
        setPositions((prev) =>
          prev.map((p) => (p.id === payload.position_id ? { ...p, status: "applied" } : p))
        );
      }
      notify("Application saved! 🎉", "success");
      setAppDialogOpen(false);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteApp() {
    if (!deleteTarget) return;
    try {
      await deleteApplication(deleteTarget.id);
      setApplications((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      notify("Application deleted.", "success");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  // ── Inline status change ──────────────────────────────────────────────────
  // ── Inline edit save handlers (update the local list in place) ────────────
  function handleCompanySaved(saved) {
    setCompanies((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
  }
  function handlePositionSaved(saved) {
    setPositions((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
  }
  function handleContactSaved(saved) {
    setContacts((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
  }

  async function handleInlineStatus(app, newStatus, e) {
    if (e) e.stopPropagation();
    try {
      const updated = await updateApplication(app.id, { status: newStatus }, notify, app.status);
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      notify(err.message, "error");
    }
  }

  // ── Detail drawer ─────────────────────────────────────────────────────────
  async function openDrawer(app) {
    setDrawerApp(app);
    setDrawerEventsLoading(true);
    try {
      const evs = await getEventsByApplication(app.id);
      setDrawerEvents(evs);
    } catch {
      setDrawerEvents([]);
    } finally {
      setDrawerEventsLoading(false);
    }
  }

  function closeDrawer() {
    setDrawerApp(null);
    setDrawerEvents([]);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const resumes = documents.filter((d) => d.type === "resume");
  const coverLetters = documents.filter((d) => d.type === "cover_letter");

  // ── Section count label ───────────────────────────────────────────────────
  function sectionCount(key) {
    const map = {
      companies: filteredCompanies.length,
      positions: filteredPositions.length,
      contacts: filteredContacts.length,
      applications: filteredApps.length,
    };
    return map[key];
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        {/* ---------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ---------------------------------------------------------------- */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3, gap: 2 }}
        >
          <Typography variant="h5" fontWeight="bold">CRM</Typography>
          <TextField
            size="small"
            placeholder="Search across everything..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
            sx={{ minWidth: 260, bgcolor: "background.paper", borderRadius: 1 }}
          />
        </Stack>

        {/* ---------------------------------------------------------------- */}
        {/* Section filter chips                                              */}
        {/* ---------------------------------------------------------------- */}
        <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: "wrap" }}>
          {SECTION_KEYS.map((key) => {
            const active = activeSections.includes(key);
            return (
              <Chip
                key={key}
                label={`${SECTION_LABELS[key]}${!loading ? ` (${sectionCount(key)})` : ""}`}
                onClick={() => toggleSection(key)}
                color={active ? "primary" : "default"}
                variant={active ? "filled" : "outlined"}
              />
            );
          })}
          {search && (
            <Chip
              label="Clear search"
              size="small"
              onDelete={() => setSearch("")}
              sx={{ ml: "auto" }}
            />
          )}
        </Stack>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={3}>
            {/* ============================================================ */}
            {/* COMPANIES section                                              */}
            {/* ============================================================ */}
            {activeSections.includes("companies") && (
              <Card>
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      🏢 Companies ({sortedCompanies.length})
                    </Typography>
                    <ColumnMenu columns={SECTION_COLUMNS.companies} visible={colVis.companies} onToggle={(k) => toggleColumn("companies", k)} />
                  </Box>
                  {sortedCompanies.length === 0 ? (
                    <Box sx={{ px: 2, py: 3 }}>
                      <Typography color="text.secondary">
                        {search ? "No companies match your search." : "No companies yet — add some! 🏢"}
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table size="small" sx={{ tableLayout: "fixed", minWidth: 700 }}>
                        <TableHead>
                          <TableRow>
                            {showCo("name") && <SortableHeader label="Name" field="name" sort={coSort} onSort={makeSortHandler(setCoSort)} width="42%" />}
                            {showCo("glassdoor_rating") && <SortableHeader label="Glassdoor" field="glassdoor_rating" sort={coSort} onSort={makeSortHandler(setCoSort)} width="14%" />}
                            {showCo("size") && <SortableHeader label="Size" field="size" sort={coSort} onSort={makeSortHandler(setCoSort)} width="12%" />}
                            {showCo("url") && <SortableHeader label="Website" field="url" sort={coSort} onSort={makeSortHandler(setCoSort)} width="12%" />}
                            {showCo("notes") && <SortableHeader label="Notes" field="notes" sort={coSort} onSort={makeSortHandler(setCoSort)} width="10%" />}
                            {showCo("actions") && <TableCell align="right" sx={{ width: "10%" }}>Actions</TableCell>}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sortedCompanies.map((co) => (
                            <TableRow key={co.id} hover>
                              {showCo("name") && (
                                <TableCell>
                                  <Typography variant="body2" fontWeight="medium">{co.name}</Typography>
                                </TableCell>
                              )}
                              {showCo("glassdoor_rating") && (
                                <TableCell>
                                  {co.glassdoor_rating ? (
                                    <Chip
                                      label={co.glassdoor_rating}
                                      size="small"
                                      color={glassdoorColor(co.glassdoor_rating)}
                                    />
                                  ) : "—"}
                                </TableCell>
                              )}
                              {showCo("size") && (
                                <TableCell>
                                  {co.size ? co.size.toLocaleString() : "—"}
                                </TableCell>
                              )}
                              {showCo("url") && (
                                <TableCell>
                                  {co.url ? (
                                    <IconButton size="small" href={co.url} target="_blank" rel="noopener noreferrer">
                                      <OpenInNewIcon fontSize="small" />
                                    </IconButton>
                                  ) : "—"}
                                </TableCell>
                              )}
                              {showCo("notes") && (
                                <TableCell><NoteCell note={co.notes} /></TableCell>
                              )}
                              {showCo("actions") && (
                                <TableCell align="right">
                                  <Tooltip title="Edit">
                                    <IconButton size="small" onClick={() => setEdit({ type: "company", entity: co })}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ============================================================ */}
            {/* POSITIONS section                                              */}
            {/* ============================================================ */}
            {activeSections.includes("positions") && (
              <Card>
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      📋 Positions ({sortedPositions.length})
                    </Typography>
                    <ColumnMenu columns={SECTION_COLUMNS.positions} visible={colVis.positions} onToggle={(k) => toggleColumn("positions", k)} />
                  </Box>
                  {sortedPositions.length === 0 ? (
                    <Box sx={{ px: 2, py: 3 }}>
                      <Typography color="text.secondary">
                        {search ? "No positions match your search." : "No positions yet — use Add Job to get started! 🚀"}
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table size="small" sx={{ tableLayout: "fixed", minWidth: 1120 }}>
                        <TableHead>
                          <TableRow>
                            {showPos("company") && <SortableHeader label="Company" field="company" sort={posSort} onSort={makeSortHandler(setPosSort)} width="13%" />}
                            {showPos("name") && <SortableHeader label="Title" field="name" sort={posSort} onSort={makeSortHandler(setPosSort)} width="16%" />}
                            {showPos("status") && <SortableHeader label="Status" field="status" sort={posSort} onSort={makeSortHandler(setPosSort)} width="12%" />}
                            {showPos("pay") && <SortableHeader label="Pay" field="pay" sort={posSort} onSort={makeSortHandler(setPosSort)} width="11%" />}
                            {showPos("location") && <SortableHeader label="Location" field="location" sort={posSort} onSort={makeSortHandler(setPosSort)} width="10%" />}
                            {showPos("type") && <SortableHeader label="Type" field="type" sort={posSort} onSort={makeSortHandler(setPosSort)} width="7%" />}
                            {showPos("created_at") && <SortableHeader label="Added" field="created_at" sort={posSort} onSort={makeSortHandler(setPosSort)} width="7%" />}
                            {showPos("notes") && <SortableHeader label="Notes" field="notes" sort={posSort} onSort={makeSortHandler(setPosSort)} width="6%" />}
                            {showPos("action") && <TableCell align="right" sx={{ width: "18%" }}>Action</TableCell>}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sortedPositions.map((pos) => {
                            const existingApp = appByPosition[pos.id];
                            const listingUrl = pos.url_application || pos.url_listing;
                            const TYPE_LABELS = {
                              full_time: "Full Time", part_time: "Part Time",
                              contract: "Contract", internship: "Internship", temporary: "Temporary",
                            };
                            return (
                              <TableRow key={pos.id} hover>
                                {showPos("company") && (
                                  <TableCell>
                                    <Typography variant="body2">{pos.companies?.name ?? "—"}</Typography>
                                  </TableCell>
                                )}
                                {showPos("name") && (
                                  <TableCell>
                                    <Typography variant="body2" fontWeight="medium">{pos.name}</Typography>
                                  </TableCell>
                                )}
                                {showPos("status") && (
                                  <TableCell>
                                    <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
                                      {posStatusChip(pos.status)}
                                      {showsInterviewMarker(existingApp) && (
                                        <Tooltip title="Reached the interview stage">
                                          <RecordVoiceOverIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                                        </Tooltip>
                                      )}
                                      {showsOfferMarker(existingApp) && (
                                        <Tooltip title="Received an offer">
                                          <EmojiEventsIcon sx={{ fontSize: 16, color: "warning.main" }} />
                                        </Tooltip>
                                      )}
                                    </Stack>
                                  </TableCell>
                                )}
                                {showPos("pay") && (
                                  <TableCell>
                                    <Typography variant="body2" sx={{ whiteSpace: "normal" }}>
                                      {formatPay(pos.pay_min, pos.pay_max, pos.pay_type)}
                                    </Typography>
                                  </TableCell>
                                )}
                                {showPos("location") && (
                                  <TableCell>
                                    <Typography variant="body2" sx={{ whiteSpace: "normal" }}>{pos.location ?? "—"}</Typography>
                                  </TableCell>
                                )}
                                {showPos("type") && (
                                  <TableCell>
                                    <Typography variant="body2" noWrap>
                                      {TYPE_LABELS[pos.type] ?? (pos.type ? pos.type : "—")}
                                    </Typography>
                                  </TableCell>
                                )}
                                {showPos("created_at") && (
                                  <TableCell>
                                    <Typography variant="body2" noWrap>
                                      {pos.created_at ? dayjs(pos.created_at).format("MM/DD/YY") : "—"}
                                    </Typography>
                                  </TableCell>
                                )}
                                {showPos("notes") && (
                                  <TableCell><NoteCell note={pos.notes} /></TableCell>
                                )}
                                {showPos("action") && (
                                  <TableCell align="right">
                                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", alignItems: "center" }}>
                                      <Tooltip title="Edit">
                                        <IconButton size="small" onClick={() => setEdit({ type: "position", entity: pos })}>
                                          <EditIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      {listingUrl && (
                                        <Tooltip title="Open listing — apply on the company's site">
                                          <IconButton size="small" href={listingUrl} target="_blank" rel="noopener noreferrer">
                                            <OpenInNewIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                      {existingApp ? (
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          color="secondary"
                                          onClick={() => openDrawer(existingApp)}
                                          sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                                        >
                                          View Application
                                        </Button>
                                      ) : (
                                        <Tooltip title="Record that you applied (doesn't apply for you)">
                                          <Button
                                            size="small"
                                            variant="contained"
                                            onClick={() => openApply(pos)}
                                            sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                                          >
                                            Log Application
                                          </Button>
                                        </Tooltip>
                                      )}
                                    </Stack>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ============================================================ */}
            {/* CONTACTS section                                               */}
            {/* ============================================================ */}
            {activeSections.includes("contacts") && (
              <Card>
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      👤 Contacts ({sortedContacts.length})
                    </Typography>
                    <ColumnMenu columns={SECTION_COLUMNS.contacts} visible={colVis.contacts} onToggle={(k) => toggleColumn("contacts", k)} />
                  </Box>
                  {sortedContacts.length === 0 ? (
                    <Box sx={{ px: 2, py: 3 }}>
                      <Typography color="text.secondary">
                        {search ? "No contacts match your search." : "No contacts yet — add people you've networked with! 🤝"}
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table size="small" sx={{ tableLayout: "fixed", minWidth: 800 }}>
                        <TableHead>
                          <TableRow>
                            {showCt("name") && <SortableHeader label="Name" field="name" sort={ctSort} onSort={makeSortHandler(setCtSort)} width="17%" />}
                            {showCt("company") && <SortableHeader label="Company" field="company" sort={ctSort} onSort={makeSortHandler(setCtSort)} width="17%" />}
                            {showCt("title") && <SortableHeader label="Title" field="title" sort={ctSort} onSort={makeSortHandler(setCtSort)} width="16%" />}
                            {showCt("email") && <SortableHeader label="Email" field="email" sort={ctSort} onSort={makeSortHandler(setCtSort)} width="19%" />}
                            {showCt("phone") && <SortableHeader label="Phone" field="phone" sort={ctSort} onSort={makeSortHandler(setCtSort)} width="13%" />}
                            {showCt("notes") && <SortableHeader label="Notes" field="notes" sort={ctSort} onSort={makeSortHandler(setCtSort)} width="8%" />}
                            {showCt("actions") && <TableCell align="right" sx={{ width: "10%" }}>Actions</TableCell>}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sortedContacts.map((ct) => (
                            <TableRow key={ct.id} hover>
                              {showCt("name") && (
                                <TableCell>
                                  <Typography variant="body2" fontWeight="medium">{ct.name}</Typography>
                                </TableCell>
                              )}
                              {showCt("company") && (
                                <TableCell>
                                  <Typography variant="body2">{ct.companies?.name ?? "—"}</Typography>
                                </TableCell>
                              )}
                              {showCt("title") && (
                                <TableCell>
                                  <Typography variant="body2">{ct.title ?? "—"}</Typography>
                                </TableCell>
                              )}
                              {showCt("email") && (
                                <TableCell>
                                  {ct.email ? (
                                    <Typography variant="body2" component="a" href={`mailto:${ct.email}`} color="primary">
                                      {ct.email}
                                    </Typography>
                                  ) : "—"}
                                </TableCell>
                              )}
                              {showCt("phone") && (
                                <TableCell>
                                  <Typography variant="body2">{ct.phone ?? "—"}</Typography>
                                </TableCell>
                              )}
                              {showCt("notes") && (
                                <TableCell><NoteCell note={ct.notes} /></TableCell>
                              )}
                              {showCt("actions") && (
                                <TableCell align="right">
                                  <Tooltip title="Edit">
                                    <IconButton size="small" onClick={() => setEdit({ type: "contact", entity: ct })}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ============================================================ */}
            {/* APPLICATIONS section                                           */}
            {/* ============================================================ */}
            {activeSections.includes("applications") && (
              <Card>
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      📨 Applications ({sortedApps.length})
                    </Typography>
                    <ColumnMenu columns={SECTION_COLUMNS.applications} visible={colVis.applications} onToggle={(k) => toggleColumn("applications", k)} />
                  </Box>
                  {sortedApps.length === 0 ? (
                    <Box sx={{ px: 2, py: 3 }}>
                      <Typography color="text.secondary">
                        {search
                          ? "No applications match your search."
                          : "No applications yet — use the Apply button on a position row to create one! 🚀"}
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table size="small" sx={{ tableLayout: "fixed", minWidth: 860 }}>
                        <TableHead>
                          <TableRow>
                            {showApp("company") && <SortableHeader label="Company" field="company" sort={appSort} onSort={makeSortHandler(setAppSort)} width="16%" />}
                            {showApp("position") && <SortableHeader label="Position" field="position" sort={appSort} onSort={makeSortHandler(setAppSort)} width="22%" />}
                            {showApp("status") && <SortableHeader label="Status" field="status" sort={appSort} onSort={makeSortHandler(setAppSort)} width="16%" />}
                            {showApp("applied_date") && <SortableHeader label="Applied" field="applied_date" sort={appSort} onSort={makeSortHandler(setAppSort)} width="13%" />}
                            {showApp("pay") && <SortableHeader label="Pay" field="pay" sort={appSort} onSort={makeSortHandler(setAppSort)} width="12%" />}
                            {showApp("docs") && <TableCell sx={{ width: "8%" }}>Docs</TableCell>}
                            {showApp("actions") && <TableCell align="right" sx={{ width: "13%" }}>Actions</TableCell>}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sortedApps.map((app) => (
                            <TableRow
                              key={app.id}
                              hover
                              onClick={() => openDrawer(app)}
                              sx={{ cursor: "pointer" }}
                            >
                              {showApp("company") && (
                                <TableCell>
                                  <Typography variant="body2">{app.positions?.companies?.name ?? "—"}</Typography>
                                </TableCell>
                              )}
                              {showApp("position") && (
                                <TableCell>
                                  <Typography variant="body2" fontWeight="medium">{app.positions?.name ?? "—"}</Typography>
                                </TableCell>
                              )}
                              {showApp("status") && (
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
                                    <Select
                                      value={app.status ?? "applied"}
                                      size="small"
                                      variant="standard"
                                      disableUnderline
                                      onChange={(e) => handleInlineStatus(app, e.target.value, e)}
                                      sx={{ fontSize: 13 }}
                                    >
                                      {APP_STATUS_OPTIONS.map((s) => (
                                        <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                                      ))}
                                    </Select>
                                    {showsInterviewMarker(app) && (
                                      <Tooltip title="Reached the interview stage">
                                        <RecordVoiceOverIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                                      </Tooltip>
                                    )}
                                    {showsOfferMarker(app) && (
                                      <Tooltip title="Received an offer">
                                        <EmojiEventsIcon sx={{ fontSize: 16, color: "warning.main" }} />
                                      </Tooltip>
                                    )}
                                  </Stack>
                                </TableCell>
                              )}
                              {showApp("applied_date") && (
                                <TableCell>
                                  {app.applied_date ? dayjs(app.applied_date).format("MMM D, YYYY") : "—"}
                                </TableCell>
                              )}
                              {showApp("pay") && (
                                <TableCell>
                                  <Typography variant="body2" sx={{ whiteSpace: "normal" }}>
                                    {formatPay(app.positions?.pay_min, app.positions?.pay_max, app.positions?.pay_type)}
                                  </Typography>
                                </TableCell>
                              )}
                              {showApp("docs") && (
                                <TableCell>
                                  <Stack direction="row" spacing={0.5}>
                                    {app.resume && (
                                      <Tooltip title={`Resume: ${app.resume.name}`}>
                                        <ArticleIcon fontSize="small" color="primary" />
                                      </Tooltip>
                                    )}
                                    {app.cover_letter && (
                                      <Tooltip title={`Cover Letter: ${app.cover_letter.name}`}>
                                        <ArticleIcon fontSize="small" color="secondary" />
                                      </Tooltip>
                                    )}
                                  </Stack>
                                </TableCell>
                              )}
                              {showApp("actions") && (
                                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                  <Tooltip title="Edit">
                                    <IconButton size="small" onClick={(e) => openEdit(app, e)}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(app); }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            )}
          </Stack>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Application detail drawer                                         */}
        {/* ---------------------------------------------------------------- */}
        <Drawer
          anchor="right"
          open={!!drawerApp}
          onClose={closeDrawer}
          sx={{ "& .MuiDrawer-paper": { width: { xs: "100%", sm: 440 } } }}
        >
          {drawerApp && (
            <Box sx={{ p: 3, height: "100%", overflow: "auto" }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">Application Detail</Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" onClick={(e) => { closeDrawer(); openEdit(drawerApp, e); }}>
                    Edit
                  </Button>
                  <IconButton onClick={closeDrawer}><CloseIcon /></IconButton>
                </Stack>
              </Stack>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={1.5} sx={{ mb: 3 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Company</Typography>
                  <Typography fontWeight="medium">{drawerApp.positions?.companies?.name ?? "—"}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Position</Typography>
                  <Typography fontWeight="medium">{drawerApp.positions?.name ?? "—"}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box sx={{ mt: 0.5 }}>{appStatusChip(drawerApp.status)}</Box>
                </Box>
                {(drawerApp.first_interview_at || drawerApp.first_offer_at) && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Milestones</Typography>
                    <Stack direction="row" sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                      {drawerApp.first_interview_at && (
                        <Chip size="small" variant="outlined" color="info" icon={<RecordVoiceOverIcon />} label="Interviewed" />
                      )}
                      {drawerApp.first_offer_at && (
                        <Chip size="small" variant="outlined" color="warning" icon={<EmojiEventsIcon />} label="Offer received" />
                      )}
                    </Stack>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">Applied Date</Typography>
                  <Typography>
                    {drawerApp.applied_date ? dayjs(drawerApp.applied_date).format("MMMM D, YYYY") : "—"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Pay</Typography>
                  <Typography>
                    {formatPay(drawerApp.positions?.pay_min, drawerApp.positions?.pay_max, drawerApp.positions?.pay_type)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Location</Typography>
                  <Typography>{drawerApp.positions?.location ?? "—"}</Typography>
                </Box>
                {drawerApp.resume && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Resume</Typography>
                    <Typography variant="body2" color="primary">{drawerApp.resume.name}</Typography>
                  </Box>
                )}
                {drawerApp.cover_letter && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Cover Letter</Typography>
                    <Typography variant="body2" color="secondary">{drawerApp.cover_letter.name}</Typography>
                  </Box>
                )}
                {drawerApp.notes && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Notes</Typography>
                    <Typography variant="body2">{drawerApp.notes}</Typography>
                  </Box>
                )}
              </Stack>

              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>Activity Timeline</Typography>

              {drawerEventsLoading ? (
                <CircularProgress size={20} />
              ) : drawerEvents.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No events yet for this application.</Typography>
              ) : (
                <MuiTimeline position="right" sx={{ px: 0, my: 0 }}>
                  {drawerEvents.map((ev, i) => (
                    <TimelineItem key={ev.id}>
                      <TimelineSeparator>
                        <TimelineDot color={EVENT_TYPE_META[ev.type]?.color ?? "grey"} />
                        {i < drawerEvents.length - 1 && <TimelineConnector />}
                      </TimelineSeparator>
                      <TimelineContent sx={{ py: 1 }}>
                        <Chip
                          label={EVENT_TYPE_META[ev.type]?.label ?? ev.type}
                          size="small"
                          color={EVENT_TYPE_META[ev.type]?.color ?? "default"}
                        />
                        <Typography variant="caption" color="text.secondary" display="block">
                          {ev.date ? dayjs(ev.date).format("MMM D, YYYY h:mm A") : "No date"}
                        </Typography>
                        {ev.notes && <Typography variant="body2">{ev.notes}</Typography>}
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </MuiTimeline>
              )}
            </Box>
          )}
        </Drawer>

        {/* ---------------------------------------------------------------- */}
        {/* Add / Edit Application dialog                                     */}
        {/* ---------------------------------------------------------------- */}
        <Dialog open={appDialogOpen} onClose={() => setAppDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingApp ? "Edit Application" : "Create Application"}</DialogTitle>
          <Divider />
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <FormControl fullWidth required>
                <InputLabel>Position</InputLabel>
                <Select
                  value={appForm.position_id}
                  label="Position"
                  onChange={(e) => setAppForm((f) => ({ ...f, position_id: e.target.value }))}
                >
                  <MenuItem value=""><em>Select position...</em></MenuItem>
                  {positions.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name} @ {p.companies?.name ?? "—"}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={appForm.status}
                  label="Status"
                  onChange={(e) => setAppForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {APP_STATUS_OPTIONS.map((s) => (
                    <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <DatePicker
                label="Applied Date"
                value={appForm.applied_date ? dayjs(appForm.applied_date) : null}
                onChange={(val) => setAppForm((f) => ({ ...f, applied_date: val?.format("YYYY-MM-DD") ?? "" }))}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <FormControl fullWidth>
                <InputLabel>Resume (optional)</InputLabel>
                <Select
                  value={appForm.resume_id}
                  label="Resume (optional)"
                  onChange={(e) => setAppForm((f) => ({ ...f, resume_id: e.target.value }))}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {resumes.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Cover Letter (optional)</InputLabel>
                <Select
                  value={appForm.cover_letter_id}
                  label="Cover Letter (optional)"
                  onChange={(e) => setAppForm((f) => ({ ...f, cover_letter_id: e.target.value }))}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {coverLetters.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField
                label="Notes"
                value={appForm.notes}
                onChange={(e) => setAppForm((f) => ({ ...f, notes: e.target.value }))}
                multiline
                minRows={2}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setAppDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSaveApp}
              disabled={saving || !appForm.position_id}
            >
              {saving ? <CircularProgress size={20} color="inherit" /> : "Save"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ---------------------------------------------------------------- */}
        {/* Delete confirm dialog                                             */}
        {/* ---------------------------------------------------------------- */}
        <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
          <DialogTitle>Delete Application</DialogTitle>
          <DialogContent>
            <Typography>
              Delete the application for{" "}
              <strong>{deleteTarget?.positions?.name ?? "this position"}</strong>? This cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeleteApp}>Delete</Button>
          </DialogActions>
        </Dialog>

        {/* ---------------------------------------------------------------- */}
        {/* Inline edit dialogs (shared with the data pages)                  */}
        {/* ---------------------------------------------------------------- */}
        {edit?.type === "company" && (
          <CompanyFormDialog
            company={edit.entity}
            onClose={() => setEdit(null)}
            onSaved={handleCompanySaved}
          />
        )}
        {edit?.type === "position" && (
          <PositionFormDialog
            position={edit.entity}
            companies={companies}
            onClose={() => setEdit(null)}
            onSaved={handlePositionSaved}
          />
        )}
        {edit?.type === "contact" && (
          <ContactFormDialog
            contact={edit.entity}
            companies={companies}
            onClose={() => setEdit(null)}
            onSaved={handleContactSaved}
          />
        )}
      </Box>
    </LocalizationProvider>
  );
}
