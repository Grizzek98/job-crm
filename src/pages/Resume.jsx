import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

import InlineText from "../components/resume/InlineText";
import SortableList from "../components/resume/SortableList";
import JobListingPanel from "../components/resume/JobListingPanel";
import { ResumePicker, TailorButton } from "../components/resume/ResumeToolbar";
import {
  deleteResume,
  getOrCreateMasterResume,
  getOrCreateTailoredResume,
  getResume,
  updateResumeContent,
} from "../services/resumeService";
import { newBullet, newEducation, newJob, newListSection } from "../utils/resumeTemplate";
import { formatDateRange, isUnreadableDateRange } from "../utils/resumeDates";
import { HEADER_TITLE_TIP, SECTION_TIPS } from "../utils/resumeTips";

const SAVE_DELAY_MS = 800;

// Page look, matching the one resume layout (US Letter, Calibri).
const PAGE = {
  width: "8.5in",
  minHeight: "11in",
  pt: "0.625in",
  pb: "0.625in",
  px: "0.75in",
  fontFamily: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif",
  fontSize: "10.5pt",
  lineHeight: 1.2,
  color: "#000",
};

// Routes:
//   /resume                  the master resume
//   /resume/:resumeId        a tailored copy
//   /resume/job/:positionId  open (or first make) the tailored copy for a job
export default function ResumePage() {
  const { resumeId, positionId } = useParams();
  if (positionId) return <OpenTailoredResume key={positionId} positionId={positionId} />;
  // A new key per resume gives each one fresh editor state and its own autosave.
  return <ResumeEditor key={resumeId ?? "master"} routeId={resumeId} />;
}

function OpenTailoredResume({ positionId }) {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getOrCreateTailoredResume(positionId)
      .then((r) => !cancelled && navigate(`/resume/${r.id}`, { replace: true }))
      .catch((err) => !cancelled && setError(err.message ?? String(err)));
    return () => {
      cancelled = true;
    };
  }, [positionId, navigate]);

  if (error) return <Alert severity="error">Couldn't make the tailored resume: {error}</Alert>;
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, py: 8 }}>
      <CircularProgress size={24} />
      <Typography color="text.secondary">Copying your master resume for this job…</Typography>
    </Box>
  );
}

function ResumeEditor({ routeId }) {
  const navigate = useNavigate();
  const [resume, setResume] = useState(null); // the row, minus content
  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved"); // "saved" | "saving" | "error"
  const [confirm, setConfirm] = useState(null); // { message, onConfirm, action }
  const resumeId = resume?.id ?? null;

  // Autosave bookkeeping (refs so the timer and unmount see the latest values).
  // saveStatus === "saving" means there are changes not yet saved.
  const latestRef = useRef(null);
  const pendingRef = useRef(false);
  const idRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (routeId ? getResume(routeId) : getOrCreateMasterResume())
      .then((r) => {
        if (cancelled) return;
        idRef.current = r.id;
        const { content: loaded, ...row } = r;
        setResume(row);
        setContent(loaded);
      })
      .catch((err) => !cancelled && setLoadError(err.message ?? String(err)));
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  useEffect(() => {
    latestRef.current = content;
  }, [content]);

  useEffect(() => {
    pendingRef.current = saveStatus === "saving";
  }, [saveStatus]);

  // Save a moment after the last change.
  useEffect(() => {
    if (!resumeId || saveStatus !== "saving") return undefined;
    const timer = setTimeout(async () => {
      const snapshot = latestRef.current;
      try {
        await updateResumeContent(resumeId, snapshot);
        // Only mark saved if nothing changed while the save was in flight.
        if (latestRef.current === snapshot) setSaveStatus("saved");
      } catch (err) {
        console.error(err);
        setSaveStatus("error");
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [content, resumeId, saveStatus]);

  // Leaving the page with unsaved typing: save it on the way out.
  useEffect(
    () => () => {
      if (pendingRef.current && idRef.current && latestRef.current) {
        updateResumeContent(idRef.current, latestRef.current).catch(console.error);
      }
    },
    [],
  );

  // ── Editing helpers ────────────────────────────────────────────────────────
  const change = (fn) => {
    setSaveStatus("saving");
    setContent((c) => fn(c));
  };

  const setHeader = (field) => (value) =>
    change((c) => ({ ...c, header: { ...c.header, [field]: value } }));

  const updateSection = (sectionId, fn) =>
    change((c) => ({
      ...c,
      sections: c.sections.map((s) => (s.id === sectionId ? fn(s) : s)),
    }));

  const askToConfirm = (message, onConfirm, action = "Delete") => setConfirm({ message, onConfirm, action });

  const deleteThisCopy = () =>
    askToConfirm(
      `Delete the tailored resume "${resume.name}"? Your master resume and the job itself stay as they are.`,
      async () => {
        pendingRef.current = false; // nothing left to save
        try {
          await deleteResume(resume.id);
          navigate("/resume");
        } catch (err) {
          console.error(err);
          setSaveStatus("error");
        }
      },
    );

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadError) {
    return <Alert severity="error">Couldn't load your resume: {loadError}</Alert>;
  }
  if (!content) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const { header } = content;
  const tailored = !resume.is_master;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1, flexWrap: "wrap" }}>
        <Typography variant="h4">Resume</Typography>
        <ResumePicker currentId={resume.id} />
        <SaveStatus status={saveStatus} />
        <Box sx={{ flex: 1 }} />
        <TailorButton />
        {tailored && (
          <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={deleteThisCopy}>
            Delete this copy
          </Button>
        )}
        <DownloadButton content={content} fileSuffix={tailored ? companyFromName(resume.name) : ""} />
      </Box>
      {tailored && (
        <Alert severity="info" sx={{ mb: 1 }}>
          This is a <strong>tailored copy</strong> for <strong>{resume.name}</strong>. Reorder and
          reword it for this job. Changes here don't affect your master resume.
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        <strong>This is the Resume Builder!</strong> This format is ATS-friendly and readable by
        the AI tools recruiters use to evaluate resumes. Click any text to change it, and press
        Enter when you're done. Drag the ⋮⋮ handle to move things around. Select words and
        press <strong>Ctrl+B</strong> to make them bold. The eye icon hides an item without
        deleting it. Point at a section heading or its lightbulb for tips.
      </Typography>

      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
      {/* Padding on top so the scroll box doesn't clip the page's shadow there. */}
      <Box sx={{ flex: 1, minWidth: 0, overflowX: "auto", pt: 1, pb: 4 }}>
        <Paper
          elevation={3}
          sx={{ ...PAGE, mx: "auto", borderRadius: 0, bgcolor: "#fff", boxSizing: "border-box" }}
        >
          {/* Header */}
          <Box sx={{ textAlign: "center", "& .ProseMirror": { textAlign: "center" } }}>
            <InlineText
              value={header.name}
              onChange={setHeader("name")}
              placeholder="Your name"
              allowBold={false}
              sx={{ fontSize: "18pt", fontWeight: 700 }}
            />
            <Row right={<TipTooltip tip={HEADER_TITLE_TIP}><TipIcon /></TipTooltip>}>
              <TipTooltip tip={HEADER_TITLE_TIP} placement="top">
                <Box>
                  <InlineText
                    value={header.title}
                    onChange={setHeader("title")}
                    placeholder="Job title"
                    allowBold={false}
                    sx={{ fontSize: "12pt", fontWeight: 700 }}
                  />
                </Box>
              </TipTooltip>
            </Row>
            <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap" }}>
              <InlineText value={header.location} onChange={setHeader("location")} placeholder="City, State" allowBold={false} sx={{ minWidth: "5em" }} />
              <Separator />
              <InlineText value={header.phone} onChange={setHeader("phone")} placeholder="Phone" allowBold={false} sx={{ minWidth: "4em" }} />
              <Separator />
              <InlineText value={header.email} onChange={setHeader("email")} placeholder="Email" allowBold={false} sx={{ minWidth: "4em" }} />
            </Box>
            <InlineText
              value={header.linkedin}
              onChange={setHeader("linkedin")}
              placeholder="LinkedIn URL"
              allowBold={false}
            />
          </Box>

          {/* Sections */}
          <SortableList
            items={content.sections}
            onReorder={(sections) => change((c) => ({ ...c, sections }))}
          >
            {(section, handle) => (
              <Section
                section={section}
                handle={handle}
                update={(fn) => updateSection(section.id, fn)}
                askToConfirm={askToConfirm}
                onDelete={() =>
                  change((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== section.id) }))
                }
              />
            )}
          </SortableList>
          {/* Sits out in the left margin, level with the section handles, so it
              doesn't look like part of the last section. */}
          <Box sx={{ mt: "12pt", ml: "-40px" }}>
            <AddButton onClick={() => change((c) => ({ ...c, sections: [...c.sections, newListSection()] }))}>
              Add section
            </AddButton>
          </Box>
        </Paper>
      </Box>
      {tailored && resume.position_id && <JobListingPanel positionId={resume.position_id} />}
      </Box>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogContent>
          <DialogContentText>{confirm?.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => {
              confirm.onConfirm();
              setConfirm(null);
            }}
          >
            {confirm?.action ?? "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// "Marketing Manager – Summit Outdoor Co." -> "Summit Outdoor Co." (for file names).
function companyFromName(name) {
  const parts = (name ?? "").split(" – ");
  return parts[parts.length - 1].trim();
}

// ── Sections ─────────────────────────────────────────────────────────────────

function Section({ section, handle, update, askToConfirm, onDelete }) {
  const tip = SECTION_TIPS[section.type];
  return (
    <Box sx={{ mt: "10pt", opacity: section.hidden ? 0.4 : 1 }}>
      <Row
        left={
          <>
            {handle}
            <HideButton hidden={section.hidden} what="section" onToggle={() => update((s) => ({ ...s, hidden: !s.hidden }))} />
          </>
        }
        right={
          <>
            {tip && (
              <TipTooltip tip={tip}>
                <TipIcon />
              </TipTooltip>
            )}
            {section.type === "list" && (
              <DeleteButton
                what="section"
                onClick={() =>
                  askToConfirm(`Delete the "${stripHtml(section.title) || "untitled"}" section and everything in it?`, onDelete)
                }
              />
            )}
          </>
        }
      >
        <TipTooltip tip={tip} placement="top-start">
          <Box>
            <InlineText
              value={section.title}
              onChange={(title) => update((s) => ({ ...s, title }))}
              placeholder={section.type === "list" ? "Section title (for example, Volunteer Experience)" : "Section title"}
              allowBold={false}
              sx={{
                fontSize: "11.5pt",
                fontWeight: 700,
                textTransform: "uppercase",
                borderBottom: "1px solid #000",
                mb: "4pt",
              }}
            />
          </Box>
        </TipTooltip>
      </Row>

      {section.type === "summary" && (
        <InlineText
          value={section.text}
          onChange={(text) => update((s) => ({ ...s, text }))}
          placeholder="A short summary of who you are and what you do"
        />
      )}

      {(section.type === "skills" || section.type === "list") && (
        <LineList
          items={section.items}
          onChange={(items) => update((s) => ({ ...s, items }))}
          placeholder={section.type === "skills" ? "Group name: skill, skill, skill" : "New line"}
          addLabel={section.type === "skills" ? "Add skill line" : "Add line"}
        />
      )}

      {section.type === "experience" && (
        <>
          <SortableList items={section.jobs} onReorder={(jobs) => update((s) => ({ ...s, jobs }))}>
            {(job, jobHandle) => (
              <Job
                job={job}
                handle={jobHandle}
                update={(fn) =>
                  update((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === job.id ? fn(j) : j)) }))
                }
                onDelete={() =>
                  askToConfirm(
                    `Delete the job "${stripHtml(job.title) || "untitled"}" and all its bullet points?`,
                    () => update((s) => ({ ...s, jobs: s.jobs.filter((j) => j.id !== job.id) })),
                  )
                }
              />
            )}
          </SortableList>
          <AddButton onClick={() => update((s) => ({ ...s, jobs: [...s.jobs, newJob()] }))}>
            Add job
          </AddButton>
        </>
      )}

      {section.type === "education" && (
        <>
          <SortableList
            items={section.entries}
            onReorder={(entries) => update((s) => ({ ...s, entries }))}
          >
            {(entry, entryHandle) => {
              const setField = (field) => (value) =>
                update((s) => ({
                  ...s,
                  entries: s.entries.map((e) => (e.id === entry.id ? { ...e, [field]: value } : e)),
                }));
              return (
                <Row
                  left={entryHandle}
                  right={
                    <DeleteButton
                      what="school"
                      onClick={() =>
                        askToConfirm(`Delete "${stripHtml(entry.degree) || "this school"}"?`, () =>
                          update((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== entry.id) })),
                        )
                      }
                    />
                  }
                  sx={{ mb: "4pt" }}
                >
                  <Box sx={{ display: "flex", flexWrap: "wrap", fontWeight: 700 }}>
                    <InlineText value={entry.degree} onChange={setField("degree")} placeholder="Degree" allowBold={false} sx={{ minWidth: "4em" }} />
                    <Separator />
                    <InlineText value={entry.school} onChange={setField("school")} placeholder="School" allowBold={false} sx={{ minWidth: "4em" }} />
                  </Box>
                  <InlineText value={entry.details} onChange={setField("details")} placeholder="Related Courses: ..." />
                </Row>
              );
            }}
          </SortableList>
          <AddButton onClick={() => update((s) => ({ ...s, entries: [...s.entries, newEducation()] }))}>
            Add school
          </AddButton>
        </>
      )}
    </Box>
  );
}

function Job({ job, handle, update, onDelete }) {
  const setField = (field) => (value) => update((j) => ({ ...j, [field]: value }));
  const [editingDates, setEditingDates] = useState(false);

  return (
    <Box sx={{ mb: "6pt" }}>
      <Row left={handle} right={<DeleteButton what="job" onClick={onDelete} />}>
        <Box sx={{ display: "flex", flexWrap: "wrap", fontWeight: 700 }}>
          <InlineText value={job.title} onChange={setField("title")} placeholder="Job title" allowBold={false} sx={{ minWidth: "4em" }} />
          <Separator />
          <InlineText value={job.company} onChange={setField("company")} placeholder="Company" allowBold={false} sx={{ minWidth: "4em" }} />
          <Separator />
          <InlineText value={job.location} onChange={setField("location")} placeholder="State" allowBold={false} sx={{ minWidth: "2em" }} />
        </Box>
        <Box onFocus={() => setEditingDates(true)} onBlur={() => setEditingDates(false)}>
          <InlineText
            value={job.dates}
            onChange={setField("dates")}
            placeholder="Start – End (for example, Feb 2022 – Present)"
            allowBold={false}
            formatOnBlur={formatDateRange}
          />
        </Box>
        {!editingDates && isUnreadableDateRange(htmlToText(job.dates)) && (
          <Typography
            variant="caption"
            color="error"
            sx={{ display: "flex", alignItems: "center", gap: 0.5, fontFamily: "Roboto, sans-serif" }}
          >
            <ErrorOutlineIcon sx={{ fontSize: 14 }} />
            Try to only use the month and year, even if you have to guess (for example, Jun 2020 – Present).
          </Typography>
        )}
        <InlineText
          value={job.description}
          onChange={setField("description")}
          placeholder="One sentence about the company (optional)"
        />
      </Row>

      <Box sx={{ pl: "0.25in" }}>
        <SortableList items={job.bullets} onReorder={(bullets) => update((j) => ({ ...j, bullets }))}>
          {(bullet, bulletHandle) => {
            const setBullet = (fn) =>
              update((j) => ({
                ...j,
                bullets: j.bullets.map((b) => (b.id === bullet.id ? fn(b) : b)),
              }));
            return (
              <Row
                left={
                  <>
                    {bulletHandle}
                    <HideButton hidden={bullet.hidden} what="bullet point" onToggle={() => setBullet((b) => ({ ...b, hidden: !b.hidden }))} />
                  </>
                }
                right={
                  <DeleteButton
                    what="bullet point"
                    onClick={() => update((j) => ({ ...j, bullets: j.bullets.filter((b) => b.id !== bullet.id) }))}
                  />
                }
                hidden={bullet.hidden}
              >
                <Box sx={{ display: "flex" }}>
                  <Box component="span" sx={{ width: "0.2in", flex: "none" }}>•</Box>
                  <InlineText
                    value={bullet.text}
                    onChange={(text) => setBullet((b) => ({ ...b, text }))}
                    placeholder="What you did and the result. Numbers stand out (for example, grew sales 35%)"
                    sx={{ flex: 1 }}
                  />
                </Box>
              </Row>
            );
          }}
        </SortableList>
        <AddButton onClick={() => update((j) => ({ ...j, bullets: [...j.bullets, newBullet()] }))}>
          Add bullet point
        </AddButton>
      </Box>
    </Box>
  );
}

// Skill lines and other one-line lists (affiliations).
function LineList({ items, onChange, placeholder, addLabel }) {
  const setItem = (id, fn) => onChange(items.map((i) => (i.id === id ? fn(i) : i)));
  return (
    <>
      <SortableList items={items} onReorder={onChange}>
        {(item, handle) => (
          <Row
            left={
              <>
                {handle}
                <HideButton hidden={item.hidden} what="line" onToggle={() => setItem(item.id, (i) => ({ ...i, hidden: !i.hidden }))} />
              </>
            }
            right={<DeleteButton what="line" onClick={() => onChange(items.filter((i) => i.id !== item.id))} />}
            hidden={item.hidden}
          >
            <InlineText
              value={item.text}
              onChange={(text) => setItem(item.id, (i) => ({ ...i, text }))}
              placeholder={placeholder}
            />
          </Row>
        )}
      </SortableList>
      <AddButton onClick={() => onChange([...items, newBullet()])}>{addLabel}</AddButton>
    </>
  );
}

// ── Small building blocks ────────────────────────────────────────────────────

// A line of the resume with editing controls in the page margins: drag handle
// and hide button on the left, delete on the right. Controls are faint until
// the pointer is over the line.
function Row({ left, right, hidden, children, sx }) {
  return (
    <Box
      sx={{
        position: "relative",
        "& > .row-controls": { opacity: 0.35, transition: "opacity 0.15s" },
        "&:hover > .row-controls, &:focus-within > .row-controls": { opacity: 1 },
        ...sx,
      }}
    >
      {left && (
        <Box className="row-controls" sx={{ position: "absolute", right: "100%", top: -2, display: "flex", pr: 0.5 }}>
          {left}
        </Box>
      )}
      <Box sx={{ opacity: hidden ? 0.4 : 1 }}>{children}</Box>
      {right && (
        <Box className="row-controls" sx={{ position: "absolute", left: "100%", top: -2, display: "flex", alignItems: "center", pl: 0.5 }}>
          {right}
        </Box>
      )}
    </Box>
  );
}

function TipIcon(props) {
  return (
    <LightbulbOutlinedIcon
      {...props}
      sx={{ fontSize: 18, color: "warning.main", m: 0.25, cursor: "help" }}
      aria-label="Tips"
    />
  );
}

// A friendly hint that appears when the pointer rests on `children`.
function TipTooltip({ tip, placement = "right-start", children }) {
  if (!tip) return children;
  return (
    <Tooltip
      placement={placement}
      enterDelay={300}
      disableInteractive
      title={
        <Box sx={{ maxWidth: 320, py: 0.5 }}>
          <Typography variant="subtitle2" sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
            <LightbulbOutlinedIcon sx={{ fontSize: 16 }} /> Tip
          </Typography>
          {tip.map((line) => (
            <Typography key={line} variant="body2" sx={{ mb: 0.75, "&:last-child": { mb: 0 } }}>
              {line}
            </Typography>
          ))}
        </Box>
      }
      slotProps={{ tooltip: { sx: { bgcolor: "grey.800", fontSize: 13 } } }}
    >
      {children}
    </Tooltip>
  );
}

function HideButton({ hidden, what, onToggle }) {
  return (
    <Tooltip title={hidden ? `Show this ${what}` : `Hide this ${what} (it stays saved)`} placement="left" disableInteractive>
      <IconButton size="small" onClick={onToggle} sx={{ p: 0.25 }} aria-label={hidden ? `Show ${what}` : `Hide ${what}`}>
        {hidden ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
      </IconButton>
    </Tooltip>
  );
}

function DeleteButton({ what, onClick }) {
  return (
    <Tooltip title={`Delete this ${what}`} placement="right" disableInteractive>
      <IconButton size="small" onClick={onClick} sx={{ p: 0.25 }} aria-label={`Delete ${what}`}>
        <DeleteOutlineIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  );
}

function AddButton({ onClick, children }) {
  return (
    <Button
      size="small"
      startIcon={<AddIcon />}
      onClick={onClick}
      sx={{ fontFamily: "Roboto, sans-serif", fontSize: 12, py: 0, minHeight: 0, opacity: 0.6, "&:hover": { opacity: 1 } }}
    >
      {children}
    </Button>
  );
}

function Separator() {
  return (
    <Box component="span" sx={{ px: "0.35em", whiteSpace: "pre" }}>
      |
    </Box>
  );
}

// "Download" with a choice of PDF or Word. Both are built in the browser from
// the same content, so they match. The libraries load only when first used.
function DownloadButton({ content, fileSuffix }) {
  const [anchor, setAnchor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const download = async (format) => {
    setAnchor(null);
    setBusy(true);
    setError(null);
    try {
      const { buildResumeModel, resumeFileName, downloadBlob } = await import("../utils/resumeExport/resumeModel");
      const model = buildResumeModel(content);
      if (format === "pdf") {
        const { buildResumePdf } = await import("../utils/resumeExport/resumePdf");
        downloadBlob(await buildResumePdf(model), resumeFileName(model, "pdf", fileSuffix));
      } else {
        const { buildResumeDocx } = await import("../utils/resumeExport/resumeDocx");
        downloadBlob(await buildResumeDocx(model), resumeFileName(model, "docx", fileSuffix));
      }
    } catch (err) {
      console.error(err);
      setError("Sorry, the download didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}
      <Button
        variant="contained"
        startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
        endIcon={<ArrowDropDownIcon />}
        disabled={busy}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        {busy ? "Preparing…" : "Download"}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => download("pdf")}>
          <ListItemIcon>
            <PictureAsPdfOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="PDF" secondary="Best for most job applications" />
        </MenuItem>
        <MenuItem onClick={() => download("docx")}>
          <ListItemIcon>
            <DescriptionOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Word (.docx)" secondary="When a job asks for Word, or to edit it later" />
        </MenuItem>
      </Menu>
    </Box>
  );
}

function SaveStatus({ status }) {
  if (status === "saving") {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <CircularProgress size={14} /> Saving…
      </Typography>
    );
  }
  if (status === "error") {
    return (
      <Typography variant="body2" color="error" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <ErrorOutlineIcon fontSize="small" /> Couldn't save. Your next change will try again.
      </Typography>
    );
  }
  return (
    <Typography variant="body2" color="success.main" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <CheckCircleOutlineIcon fontSize="small" /> All changes saved
    </Typography>
  );
}

function stripHtml(html) {
  return (html ?? "").replace(/<[^>]+>/g, "").trim();
}

// Plain text of a stored field (tags removed, &amp; etc. turned back into characters).
function htmlToText(html) {
  return stripHtml(html).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
