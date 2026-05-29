import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  Drawer,
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
import { getApplications, createApplication, updateApplication, deleteApplication } from "../services/applicationService";
import { getCompanies } from "../services/companyService";
import { getPositions } from "../services/positionService";
import { getContacts } from "../services/contactService";
import { getDocuments } from "../services/documentService";
import { getEventsByApplication } from "../services/eventService";
import { useNotify } from "../context/NotificationContext";

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

function formatPay(payMin, payMax, payType) {
  if (!payMin && !payMax) return "—";
  const fmt = (n) => `$${Number(n).toLocaleString()}`;
  const range = [payMin && fmt(payMin), payMax && fmt(payMax)].filter(Boolean).join("–");
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

// ---------------------------------------------------------------------------
// SortableHeader
// ---------------------------------------------------------------------------

function SortableHeader({ label, field, sort, onSort, align = "left" }) {
  const active = sort.field === field;
  return (
    <TableCell
      align={align}
      onClick={() => onSort(field)}
      sx={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
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
                  <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      🏢 Companies ({sortedCompanies.length})
                    </Typography>
                  </Box>
                  {sortedCompanies.length === 0 ? (
                    <Box sx={{ px: 2, py: 3 }}>
                      <Typography color="text.secondary">
                        {search ? "No companies match your search." : "No companies yet — add some! 🏢"}
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <SortableHeader label="Name" field="name" sort={coSort} onSort={makeSortHandler(setCoSort)} />
                            <SortableHeader label="Glassdoor" field="glassdoor_rating" sort={coSort} onSort={makeSortHandler(setCoSort)} />
                            <SortableHeader label="Size" field="size" sort={coSort} onSort={makeSortHandler(setCoSort)} />
                            <SortableHeader label="Website" field="url" sort={coSort} onSort={makeSortHandler(setCoSort)} />
                            <SortableHeader label="Notes" field="notes" sort={coSort} onSort={makeSortHandler(setCoSort)} />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sortedCompanies.map((co) => (
                            <TableRow key={co.id} hover>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">{co.name}</Typography>
                              </TableCell>
                              <TableCell>
                                {co.glassdoor_rating ? (
                                  <Chip
                                    label={co.glassdoor_rating}
                                    size="small"
                                    color={glassdoorColor(co.glassdoor_rating)}
                                  />
                                ) : "—"}
                              </TableCell>
                              <TableCell>
                                {co.size ? co.size.toLocaleString() : "—"}
                              </TableCell>
                              <TableCell>
                                {co.url ? (
                                  <IconButton size="small" href={co.url} target="_blank" rel="noopener noreferrer">
                                    <OpenInNewIcon fontSize="small" />
                                  </IconButton>
                                ) : "—"}
                              </TableCell>
                              <TableCell>
                                {co.notes ? (
                                  <Tooltip title={co.notes}>
                                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                      {co.notes}
                                    </Typography>
                                  </Tooltip>
                                ) : "—"}
                              </TableCell>
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
                  <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      📋 Positions ({sortedPositions.length})
                    </Typography>
                  </Box>
                  {sortedPositions.length === 0 ? (
                    <Box sx={{ px: 2, py: 3 }}>
                      <Typography color="text.secondary">
                        {search ? "No positions match your search." : "No positions yet — use Add Job to get started! 🚀"}
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <SortableHeader label="Company" field="company" sort={posSort} onSort={makeSortHandler(setPosSort)} />
                            <SortableHeader label="Title" field="name" sort={posSort} onSort={makeSortHandler(setPosSort)} />
                            <SortableHeader label="Status" field="status" sort={posSort} onSort={makeSortHandler(setPosSort)} />
                            <SortableHeader label="Pay" field="pay" sort={posSort} onSort={makeSortHandler(setPosSort)} />
                            <SortableHeader label="Location" field="location" sort={posSort} onSort={makeSortHandler(setPosSort)} />
                            <SortableHeader label="Type" field="type" sort={posSort} onSort={makeSortHandler(setPosSort)} />
                            <TableCell align="right">Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sortedPositions.map((pos) => {
                            const existingApp = appByPosition[pos.id];
                            const TYPE_LABELS = {
                              full_time: "Full Time", part_time: "Part Time",
                              contract: "Contract", internship: "Internship", temporary: "Temporary",
                            };
                            return (
                              <TableRow key={pos.id} hover>
                                <TableCell>
                                  <Typography variant="body2">{pos.companies?.name ?? "—"}</Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontWeight="medium">{pos.name}</Typography>
                                </TableCell>
                                <TableCell>{posStatusChip(pos.status)}</TableCell>
                                <TableCell>
                                  <Typography variant="body2" noWrap>
                                    {formatPay(pos.pay_min, pos.pay_max, pos.pay_type)}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" noWrap>{pos.location ?? "—"}</Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" noWrap>
                                    {TYPE_LABELS[pos.type] ?? (pos.type ? pos.type : "—")}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
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
                                    <Button
                                      size="small"
                                      variant="contained"
                                      onClick={() => openApply(pos)}
                                      sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                                    >
                                      Apply
                                    </Button>
                                  )}
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
            )}

            {/* ============================================================ */}
            {/* CONTACTS section                                               */}
            {/* ============================================================ */}
            {activeSections.includes("contacts") && (
              <Card>
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      👤 Contacts ({sortedContacts.length})
                    </Typography>
                  </Box>
                  {sortedContacts.length === 0 ? (
                    <Box sx={{ px: 2, py: 3 }}>
                      <Typography color="text.secondary">
                        {search ? "No contacts match your search." : "No contacts yet — add people you've networked with! 🤝"}
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <SortableHeader label="Name" field="name" sort={ctSort} onSort={makeSortHandler(setCtSort)} />
                            <SortableHeader label="Company" field="company" sort={ctSort} onSort={makeSortHandler(setCtSort)} />
                            <SortableHeader label="Title" field="title" sort={ctSort} onSort={makeSortHandler(setCtSort)} />
                            <SortableHeader label="Email" field="email" sort={ctSort} onSort={makeSortHandler(setCtSort)} />
                            <SortableHeader label="Phone" field="phone" sort={ctSort} onSort={makeSortHandler(setCtSort)} />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sortedContacts.map((ct) => (
                            <TableRow key={ct.id} hover>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">{ct.name}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{ct.companies?.name ?? "—"}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{ct.title ?? "—"}</Typography>
                              </TableCell>
                              <TableCell>
                                {ct.email ? (
                                  <Typography variant="body2" component="a" href={`mailto:${ct.email}`} color="primary">
                                    {ct.email}
                                  </Typography>
                                ) : "—"}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{ct.phone ?? "—"}</Typography>
                              </TableCell>
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
                  <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      📨 Applications ({sortedApps.length})
                    </Typography>
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
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <SortableHeader label="Company" field="company" sort={appSort} onSort={makeSortHandler(setAppSort)} />
                            <SortableHeader label="Position" field="position" sort={appSort} onSort={makeSortHandler(setAppSort)} />
                            <SortableHeader label="Status" field="status" sort={appSort} onSort={makeSortHandler(setAppSort)} />
                            <SortableHeader label="Applied" field="applied_date" sort={appSort} onSort={makeSortHandler(setAppSort)} />
                            <SortableHeader label="Pay" field="pay" sort={appSort} onSort={makeSortHandler(setAppSort)} />
                            <TableCell>Docs</TableCell>
                            <TableCell align="right">Actions</TableCell>
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
                              <TableCell>
                                <Typography variant="body2">{app.positions?.companies?.name ?? "—"}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">{app.positions?.name ?? "—"}</Typography>
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
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
                              </TableCell>
                              <TableCell>
                                {app.applied_date ? dayjs(app.applied_date).format("MMM D, YYYY") : "—"}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" noWrap>
                                  {formatPay(app.positions?.pay_min, app.positions?.pay_max, app.positions?.pay_type)}
                                </Typography>
                              </TableCell>
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
      </Box>
    </LocalizationProvider>
  );
}
