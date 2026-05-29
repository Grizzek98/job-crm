import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
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
  useTheme,
} from "@mui/material";
import { PieChart, Pie, Cell } from "recharts";
import dayjs from "dayjs";
import confetti from "canvas-confetti";
import AddBoxIcon from "@mui/icons-material/AddBox";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RemoveIcon from "@mui/icons-material/Remove";
import DoneIcon from "@mui/icons-material/Done";
import UndoIcon from "@mui/icons-material/Undo";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AddIcon from "@mui/icons-material/Add";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import {
  getStats,
  getPositionsNeedingAttention,
  getStaleApplications,
} from "../services/dashboardService";
import {
  getGoalsForDate,
  createGoal,
  updateGoal,
  deleteGoal,
  generateGoalsForToday,
  refreshAutoGoals,
  reorderGoals,
} from "../services/goalService";
import { getFocusVideos } from "../services/focusVideoService";
import { getSettings } from "../services/settingsService";
import { useNotify } from "../context/NotificationContext";
import { useFocus } from "../context/FocusContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatPay(pos) {
  if (!pos.pay_min && !pos.pay_max) return null;
  const fmt = (n) => `$${Number(n).toLocaleString()}`;
  const parts = [pos.pay_min && fmt(pos.pay_min), pos.pay_max && fmt(pos.pay_max)]
    .filter(Boolean)
    .join(" – ");
  const suffix = pos.pay_type === "hourly" ? "/hr" : pos.pay_type === "salary" ? "/yr" : "";
  return parts + suffix;
}

function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}

// ---------------------------------------------------------------------------
// Stats motivational copy
// ---------------------------------------------------------------------------

function statsMessage(key, count) {
  if (key === "totalApplications") {
    if (count === 0) return "Let's get that first application in today! You've got this 💪";
    if (count < 5) return `${count} applications in — every journey starts somewhere! Keep going!`;
    if (count < 20) return `You've applied to ${count} jobs! You're building great momentum 🔥`;
    if (count < 50) return `Wow, ${count} applications! You are absolutely crushing it! So proud of you 🎉`;
    return `${count} applications?! Holy shit, you are AMAZING! I'm really proud of you 🌟`;
  }
  if (key === "appliedThisWeek") {
    if (count === 0) return "Nothing this week yet — let's change that today!";
    if (count === 1) return "1 application this week — great start! Keep it up!";
    if (count < 5) return `You applied to ${count} jobs this week! Holy shit bro you are amazing! I'm really proud of you :)`;
    return `${count} applications this week?! You are on absolute fire! 🔥🔥🔥`;
  }
  if (key === "activeInterviews") {
    if (count === 0) return "No active interviews yet — they're coming, keep applying!";
    if (count === 1) return "1 active interview! Go get 'em! 🤞";
    return `${count} active interviews — look at you go! You're a superstar ⭐`;
  }
  if (key === "offersReceived") {
    if (count === 0) return "No offers yet — but they're coming. Keep pushing!";
    if (count === 1) return "1 offer received! You did it! 🎊";
    return `${count} offers! You're literally incredible. Options are power! 💫`;
  }
  return "";
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({ label, value, msgKey, loading }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <>
            <Typography variant="h3" fontWeight="bold" color="primary">{value}</Typography>
            <Typography variant="subtitle1" fontWeight="medium" gutterBottom>{label}</Typography>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
              {statsMessage(msgKey, value)}
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Position tier chip helpers
// ---------------------------------------------------------------------------

const TIER_CONFIG = {
  stale:    { label: "Stale",          color: "error"   },
  applying: { label: "Finish Applying", color: "warning" },
  unapplied:{ label: "Unapplied",       color: "default" },
};

function appStatusLabel(status) {
  const map = { applied: "Applied", applying: "Applying", active: "Active",
                closed: "Closed", not_interested: "Not Interested",
                interviewing: "Interviewing" };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// Goal helpers
// ---------------------------------------------------------------------------

const GOAL_TYPE_OPTIONS = [
  { value: "number", label: "Number" },
  { value: "time",   label: "Time"   },
  { value: "custom", label: "Custom" },
];

const GOAL_TYPE_SHORT = {
  number: "#",
  time:   "⏱",
  custom: "✏",
};

// category: "number" | "time" | "custom"
// number → [−] decrements, [✓] increments (auto-completes at target), current editable
// time   → [−] disabled until completed (then ↩), [✓] marks complete, current editable
// custom → [−] disabled until completed (then ↩), [✓] marks complete, current = —
function goalCategory(type) {
  if (["number", "apply_jobs", "add_positions", "complete_pomodoros"].includes(type)) return "number";
  if (["time", "spend_time"].includes(type)) return "time";
  return "custom";
}

// rect must be captured from getBoundingClientRect() BEFORE any await,
// because e.currentTarget is nulled out after async suspension.
function burstConfetti(rect) {
  confetti({
    particleCount: 22,
    spread: 38,
    startVelocity: 20,
    origin: {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top  + rect.height / 2) / window.innerHeight,
    },
    scalar: 0.8,
    ticks: 90,
  });
}

// Big celebration burst — fires from the button that triggered completion.
// Two angled streams originating from the same point give a fountain effect.
function celebrateConfetti(rect) {
  const origin = rect
    ? { x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top  + rect.height / 2) / window.innerHeight }
    : { y: 0.6 };
  confetti({ particleCount: 70, spread: 55, startVelocity: 45, angle: 60,  origin });
  confetti({ particleCount: 70, spread: 55, startVelocity: 45, angle: 120, origin });
}

// Zone widths (px)
const DRAG_W  = 32;   // drag handle column
const RIGHT_W = 120;  // [−][current][✓] action zone

// Hover style for inline-editable cells
const HOVER_SX = {
  cursor: "pointer",
  borderRadius: 1,
  px: 0.5,
  py: 0.25,
  "&:hover": { bgcolor: "action.hover" },
};

// ---------------------------------------------------------------------------
// GoalRow
// ---------------------------------------------------------------------------

function GoalRow({ goal, onUpdate, onDelete, deleteMode, autoFocus,
                   // dnd-kit sortable props (optional — omitted for DragOverlay clone)
                   sortableRef, sortableStyle, isDragging = false,
                   dragListeners, dragAttributes, isOverlay = false }) {
  const [editingField, setEditingField] = useState(autoFocus ? "label" : null);
  const [editVal, setEditVal]           = useState(autoFocus ? (goal.label ?? "") : "");
  const currentValRef                   = useRef(null);

  const category    = goalCategory(goal.type);
  const isCompleted = goal.completed;

  // ── Button state ──────────────────────────────────────────────────────────
  // − button: undo when completed; decrement when number+current>0; else disabled
  const negIsUndo   = isCompleted;
  const negDisabled = !isCompleted && (category !== "number" || (goal.current_value ?? 0) === 0);
  // ✓ button: disabled when already complete
  const posDisabled = isCompleted;
  // Current value is editable for number/time only, not when completed or in delete mode
  const canEditCurrent = !isCompleted && !deleteMode && category !== "custom";

  function startEdit(field, val) {
    if (isCompleted || deleteMode) return;
    setEditingField(field);
    setEditVal(String(val ?? ""));
  }

  function cancelEdit() {
    setEditingField(null);
    setEditVal("");
  }

  async function commit(field, value) {
    cancelEdit();
    const updates = { [field]: value };
    if (field === "type") {
      if (value === "custom") {
        updates.target_value  = null;
        updates.current_value = 0;
        updates.completed     = false;
      } else if (!goal.target_value) {
        updates.target_value = value === "time" ? 30 : 3;
      }
    }
    await onUpdate(goal.id, updates);
  }

  // Committing current_value via inline edit — includes confetti & auto-complete
  async function commitCurrentValue(rawVal) {
    cancelEdit();
    const newVal = rawVal === "" ? 0 : parseInt(rawVal, 10);
    if (isNaN(newVal)) return;
    const oldVal  = goal.current_value ?? 0;
    const updates = { current_value: newVal };

    if (newVal > oldVal) {
      // Capture rect before any await
      const rect = currentValRef.current?.getBoundingClientRect();
      if (rect) burstConfetti(rect);
      if (goal.target_value != null && newVal >= goal.target_value) {
        updates.completed = true;
        setTimeout(() => celebrateConfetti(rect), 150);
      }
    }
    await onUpdate(goal.id, updates);
  }

  // ✓ for number goals: increment +1, auto-complete at target
  async function handleIncrement(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const next = (goal.current_value ?? 0) + 1;
    const done = goal.target_value != null && next >= goal.target_value;
    burstConfetti(rect);
    if (done) setTimeout(() => celebrateConfetti(rect), 150);
    await onUpdate(goal.id, { current_value: next, ...(done ? { completed: true } : {}) });
  }

  // ✓ for time/custom goals: mark complete
  async function handleComplete(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    burstConfetti(rect);
    setTimeout(() => celebrateConfetti(rect), 150);
    await onUpdate(goal.id, { completed: true });
  }

  // − for number goals (not completed): decrement
  async function handleNeg() {
    await onUpdate(goal.id, { current_value: Math.max(0, (goal.current_value ?? 0) - 1) });
  }

  // − when completed (any type): full undo
  async function handleUndo() {
    await onUpdate(goal.id, { completed: false, current_value: 0 });
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Box
      ref={sortableRef}
      style={sortableStyle}
      sx={{
        display: "flex",
        alignItems: "stretch",
        minHeight: 52,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: isOverlay
          ? "background.paper"
          : isCompleted ? "rgba(76,175,80,0.07)" : "transparent",
        boxShadow: isOverlay ? 6 : 0,
        borderRadius: isOverlay ? 1 : 0,
        opacity: isDragging ? 0 : 1,
        transition: "background-color 0.25s, box-shadow 0.2s",
        "&:last-child": { borderBottom: 0 },
        // Reveal handle on row hover
        "&:hover .goal-drag-handle": { opacity: 0.5 },
      }}
    >
      {/* Drag handle zone */}
      <Box
        className="goal-drag-handle"
        {...dragListeners}
        {...dragAttributes}
        sx={{
          width: DRAG_W, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: isOverlay ? "grabbing" : "grab",
          opacity: isOverlay ? 0.6 : 0,
          transition: "opacity 0.15s",
          "&:hover": { opacity: 1 },
          // Prevent text selection while dragging
          userSelect: "none",
          touchAction: "none",
          color: "text.secondary",
        }}
      >
        <DragHandleIcon sx={{ fontSize: 18 }} />
      </Box>

      {/* Content zone */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1, px: 1, overflow: "hidden" }}>

        {/* Type */}
        {editingField === "type" ? (
          <Select
            autoFocus size="small" value={editVal} variant="standard"
            onChange={(e) => commit("type", e.target.value)}
            onBlur={cancelEdit}
            sx={{ minWidth: 90 }}
          >
            {GOAL_TYPE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        ) : (
          <Box onClick={() => startEdit("type", goal.type)} sx={{ ...HOVER_SX, flexShrink: 0 }}>
            <Chip
              label={GOAL_TYPE_SHORT[goal.type] ?? goal.type}
              size="small" variant="outlined"
              sx={{ fontSize: "0.7rem", cursor: "pointer" }}
            />
          </Box>
        )}

        {/* Date */}
        <Box sx={{ flexShrink: 0 }}>
          {editingField === "date" ? (
            <input
              type="date" autoFocus defaultValue={goal.date}
              onBlur={(e)    => commit("date", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  commit("date", e.target.value);
                if (e.key === "Escape") cancelEdit();
              }}
              style={{
                fontSize: "0.8rem", border: "1px solid #aaa", borderRadius: 4,
                padding: "2px 4px", width: 88, background: "transparent", color: "inherit",
              }}
            />
          ) : (
            <Box onClick={() => startEdit("date", goal.date)} sx={{ ...HOVER_SX }}>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                {dayjs(goal.date).format("M/D")}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Label */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {editingField === "label" ? (
            <TextField
              autoFocus size="small" variant="standard" fullWidth
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onBlur={() => commit("label", editVal)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  commit("label", editVal);
                if (e.key === "Escape") cancelEdit();
              }}
            />
          ) : (
            <Box onClick={() => startEdit("label", goal.label)} sx={{ ...HOVER_SX }}>
              <Typography
                variant="body2" noWrap
                sx={{
                  textDecoration: isCompleted ? "line-through" : "none",
                  color: isCompleted ? "text.secondary" : "text.primary",
                }}
              >
                {goal.label || <em style={{ opacity: 0.4 }}>Untitled goal</em>}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Target */}
        <Box sx={{ flexShrink: 0, minWidth: 36, textAlign: "center" }}>
          {category !== "custom" ? (
            editingField === "target_value" ? (
              <TextField
                autoFocus size="small" type="number" variant="standard"
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onBlur={() => commit("target_value", editVal === "" ? null : parseInt(editVal, 10))}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  commit("target_value", editVal === "" ? null : parseInt(editVal, 10));
                  if (e.key === "Escape") cancelEdit();
                }}
                sx={{ width: 44 }}
              />
            ) : (
              <Box onClick={() => startEdit("target_value", goal.target_value ?? "")} sx={{ ...HOVER_SX, textAlign: "center" }}>
                <Typography variant="body2">{goal.target_value ?? "—"}</Typography>
              </Box>
            )
          ) : (
            <Typography variant="body2" color="text.disabled">—</Typography>
          )}
        </Box>

      </Box>

      {/* Right action zone: [−][current][✓]  — or [✗] in delete mode */}
      <Box
        sx={{
          width: RIGHT_W, flexShrink: 0,
          display: "flex", alignItems: "stretch",
          borderLeft: "1px solid", borderColor: "divider",
        }}
      >
        {deleteMode ? (
          <Button
            sx={{ flex: 1, borderRadius: 0, minWidth: 0 }}
            color="error"
            onClick={() => onDelete(goal.id)}
          >
            <CloseIcon fontSize="small" />
          </Button>
        ) : (
          <>
            {/* − / ↩ button */}
            <Button
              sx={{
                width: 36, flexShrink: 0, borderRadius: 0, minWidth: 0,
                borderRight: "1px solid", borderColor: "divider",
              }}
              disabled={negDisabled}
              onClick={negIsUndo ? handleUndo : handleNeg}
              color={negIsUndo ? "warning" : "inherit"}
            >
              {negIsUndo ? <UndoIcon fontSize="small" /> : <RemoveIcon fontSize="small" />}
            </Button>

            {/* Current value — editable for number/time, — for custom */}
            <Box
              ref={currentValRef}
              onClick={() => canEditCurrent && startEdit("current_value", goal.current_value ?? 0)}
              sx={{
                flex: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: canEditCurrent ? "pointer" : "default",
                "&:hover": canEditCurrent ? { bgcolor: "action.hover" } : {},
              }}
            >
              {editingField === "current_value" ? (
                <TextField
                  autoFocus size="small" type="number" variant="standard"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onBlur={() => commitCurrentValue(editVal)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")  commitCurrentValue(editVal);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  sx={{ width: 40 }}
                  slotProps={{ input: { sx: { textAlign: "center" } } }}
                />
              ) : category === "custom" ? (
                <Typography variant="body2" color="text.disabled">—</Typography>
              ) : (
                <Typography
                  variant="body2"
                  fontWeight={isCompleted ? "bold" : "normal"}
                  color={isCompleted ? "primary.main" : "text.primary"}
                >
                  {goal.current_value ?? 0}
                </Typography>
              )}
            </Box>

            {/* ✓ button */}
            <Button
              sx={{
                width: 36, flexShrink: 0, borderRadius: 0, minWidth: 0,
                borderLeft: "1px solid", borderColor: "divider",
              }}
              disabled={posDisabled}
              onClick={category === "number" ? handleIncrement : handleComplete}
              color="primary"
              variant={posDisabled ? "text" : "contained"}
              disableElevation
            >
              <DoneIcon fontSize="small" />
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// SortableGoalRow — thin dnd-kit wrapper around GoalRow
// ---------------------------------------------------------------------------

function SortableGoalRow(props) {
  const {
    attributes, listeners,
    setNodeRef, transform, transition,
    isDragging,
  } = useSortable({ id: props.goal.id });

  return (
    <GoalRow
      {...props}
      sortableRef={setNodeRef}
      sortableStyle={{ transform: CSS.Transform.toString(transform), transition }}
      isDragging={isDragging}
      dragListeners={listeners}
      dragAttributes={attributes}
    />
  );
}

// ---------------------------------------------------------------------------
// Time of day greeting
// ---------------------------------------------------------------------------

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const MAX_POSITION_ROWS = 8;

export default function Dashboard() {
  const theme = useTheme();
  const notify = useNotify();
  const navigate = useNavigate();
  const { setCurrentVideo } = useFocus();

  const [stats,           setStats]           = useState(null);
  const [positionsNeeding,setPositionsNeeding] = useState([]);
  const [staleApps,       setStaleApps]        = useState([]);
  const [settings,        setSettings]         = useState(null);
  const [focusVideos,     setFocusVideos]      = useState([]);
  const [currentVideoTitle, setCurrentVideoTitle] = useState(null);
  const [loading,         setLoading]          = useState(true);

  // Goals state
  const [goals,        setGoals]        = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [deleteMode,   setDeleteMode]   = useState(false);
  const [newGoalId,    setNewGoalId]    = useState(null);
  const [activeGoalId, setActiveGoalId] = useState(null);  // dnd active item

  // dnd-kit sensors — 5px pointer activation so clicks still work
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [statsData, settingsData, videos] = await Promise.all([
        getStats(),
        getSettings(),
        getFocusVideos(),
      ]);
      setStats(statsData);
      setSettings(settingsData);
      setFocusVideos(videos);

      const [positions, apps] = await Promise.all([
        getPositionsNeedingAttention(settingsData),
        getStaleApplications(settingsData),
      ]);
      setPositionsNeeding(positions);
      setStaleApps(apps);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
    // Goals: load separately so the rest of the page isn't blocked
    loadGoals();
  }

  async function loadGoals() {
    setGoalsLoading(true);
    try {
      const today = todayStr();
      // Auto-generate if no goals exist for today yet (no-op if already done)
      const generated = await generateGoalsForToday();
      // generated === null means goals already existed; fetch them
      if (generated === null) {
        setGoals(await getGoalsForDate(today));
      } else {
        setGoals(generated.length > 0 ? await getGoalsForDate(today) : []);
      }
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setGoalsLoading(false);
    }
  }

  // ── Goal CRUD ─────────────────────────────────────────────────────────────

  async function handleUpdateGoal(id, updates) {
    try {
      const updated = await updateGoal(id, updates);
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
    } catch (err) {
      notify(err.message, "error");
    }
  }

  async function handleDeleteGoal(id) {
    try {
      await deleteGoal(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
      if (goals.length <= 1) setDeleteMode(false);
    } catch (err) {
      notify(err.message, "error");
    }
  }

  async function handleAddGoal() {
    try {
      // Place after the last explicitly-sorted goal so it appears at the bottom
      const maxOrder = goals.reduce((m, g) => Math.max(m, g.sort_order ?? -1), -1);
      const created = await createGoal({
        date: todayStr(),
        type: "custom",
        label: "New goal",
        target_value: null,
        current_value: 0,
        completed: false,
        is_auto: false,
        sort_order: maxOrder + 1,
      });
      setGoals((prev) => [...prev, created]);
      setNewGoalId(created.id);
      setDeleteMode(false);
    } catch (err) {
      notify(err.message, "error");
    }
  }

  async function handleRefreshGoals() {
    setGoalsLoading(true);
    try {
      await refreshAutoGoals();
      setGoals(await getGoalsForDate(todayStr()));
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setGoalsLoading(false);
    }
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  function handleDragStart({ active }) {
    setActiveGoalId(active.id);
  }

  function handleDragEnd({ active, over }) {
    setActiveGoalId(null);
    if (!over || active.id === over.id) return;

    setGoals((prev) => {
      const oldIndex = prev.findIndex((g) => g.id === active.id);
      const newIndex = prev.findIndex((g) => g.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      // Persist in background — don't block the UI
      reorderGoals(reordered.map((g) => g.id)).catch((err) =>
        notify("Couldn't save goal order: " + err.message, "warning")
      );
      return reordered;
    });
  }

  // ── Focus ─────────────────────────────────────────────────────────────────

  function loadRandomVideo() {
    if (!focusVideos.length) { navigate("/focus"); return; }
    const v = focusVideos[Math.floor(Math.random() * focusVideos.length)];
    setCurrentVideo({ id: v.id, title: v.title, url: v.url });
    setCurrentVideoTitle(v.title);
    notify(`Now playing: ${v.title} 🎵`, "info");
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const visiblePositions   = positionsNeeding.slice(0, MAX_POSITION_ROWS);
  const hiddenPositionCount = positionsNeeding.length - visiblePositions.length;
  const completedGoals     = goals.filter((g) => g.completed).length;
  const allGoalsDone       = goals.length > 0 && completedGoals === goals.length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Good {getTimeOfDay()}! Ready to land your next job? 💼
          </Typography>
        </Box>
        <Button
          variant="contained" size="large" startIcon={<AddBoxIcon />}
          onClick={() => navigate("/add-job")} sx={{ fontWeight: "bold" }}
        >
          Add Job
        </Button>
      </Stack>

      {/* ── Stats cards ─────────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Total Applications", msgKey: "totalApplications", val: stats?.totalApplications ?? 0 },
          { label: "Applied This Week",  msgKey: "appliedThisWeek",   val: stats?.appliedThisWeek   ?? 0 },
          { label: "Active Interviews",  msgKey: "activeInterviews",  val: stats?.activeInterviews  ?? 0 },
          { label: "Offers Received",    msgKey: "offersReceived",    val: stats?.offersReceived    ?? 0 },
        ].map((s) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={s.msgKey}>
            <StatCard label={s.label} value={s.val} msgKey={s.msgKey} loading={loading} />
          </Grid>
        ))}
      </Grid>

      {/* ── Positions Needing Attention + Stale Applications (side-by-side on md+) ── */}
      <Grid container spacing={3} sx={{ mb: 3 }}>

        {/* Positions Needing Attention */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ pb: "12px !important" }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <Typography variant="h6">🎯 Positions Needing Attention</Typography>
                <Button size="small" onClick={() => navigate("/positions")}>All →</Button>
              </Stack>

              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={24} /></Box>
              ) : positionsNeeding.length === 0 ? (
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", py: 2 }}>
                  <CheckCircleIcon color="primary" />
                  <Typography color="text.secondary" sx={{ fontStyle: "italic" }}>
                    All clear! No positions need attention right now. You're crushing it! 🎉
                  </Typography>
                </Stack>
              ) : (
                <>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: 80 }}>Urgency</TableCell>
                          <TableCell>Position</TableCell>
                          <TableCell>Updated</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visiblePositions.map((pos) => {
                          const tier = TIER_CONFIG[pos.tier];
                          const listingUrl = pos.url_application || pos.url_listing;
                          return (
                            <TableRow key={pos.id} hover>
                              <TableCell>
                                <Chip label={tier.label} color={tier.color} size="small" sx={{ fontSize: "0.7rem" }} />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium" noWrap>{pos.name}</Typography>
                                <Typography variant="caption" color="text.secondary" noWrap display="block">
                                  {pos.companies?.name ?? "—"}{formatPay(pos) ? ` · ${formatPay(pos)}` : ""}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary" noWrap>{daysAgo(pos.updated_at)}</Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                                  {listingUrl && (
                                    <Tooltip title="Open Listing">
                                      <IconButton size="small" href={listingUrl} target="_blank" rel="noopener noreferrer">
                                        <OpenInNewIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  <Button
                                    size="small" variant="outlined"
                                    onClick={() => navigate(`/crm?apply=${pos.id}`)}
                                    sx={{ whiteSpace: "nowrap", minWidth: "unset", px: 1, fontSize: "0.7rem" }}
                                  >
                                    Apply
                                  </Button>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {hiddenPositionCount > 0 && (
                    <Box sx={{ pt: 1.5, pb: 0.5, textAlign: "right" }}>
                      <Button size="small" onClick={() => navigate("/positions")}>
                        See {hiddenPositionCount} more →
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Stale Applications */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ pb: "12px !important" }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <Typography variant="h6">👻 Stale Applications</Typography>
                <Button size="small" onClick={() => navigate("/crm")}>View CRM →</Button>
              </Stack>

              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={24} /></Box>
              ) : staleApps.length === 0 ? (
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", py: 2 }}>
                  <CheckCircleIcon color="primary" />
                  <Typography color="text.secondary" sx={{ fontStyle: "italic" }}>
                    No stale applications — all your active apps have had recent activity. Keep it up! 🔥
                  </Typography>
                </Stack>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Position</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Last Activity</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {staleApps.map((app) => (
                        <TableRow key={app.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate("/crm")}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium" noWrap>{app.positions?.name ?? "—"}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">
                              {app.positions?.companies?.name ?? "—"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={appStatusLabel(app.status)} size="small"
                              color={app.status === "interviewing" ? "info" : "default"}
                              sx={{ fontSize: "0.7rem" }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="error.main">{daysAgo(app.updated_at)}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

      </Grid>

      {/* ── Bottom row: Goals + Focus ─────────────────────────────────────── */}
      <Grid container spacing={3}>

        {/* Goals panel */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            {/* Goals header */}
            <Box sx={{ px: 2, pt: 2, pb: 1 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                  <Typography variant="h6">🎯 Today's Goals</Typography>
                  {goals.length > 0 && (
                    <Box sx={{ position: "relative", width: 48, height: 48 }}>
                      <PieChart width={48} height={48}>
                        <Pie
                          data={[
                            { name: "Done", value: completedGoals },
                            { name: "Left", value: Math.max(0, goals.length - completedGoals) },
                          ]}
                          cx="50%" cy="50%"
                          innerRadius={14} outerRadius={22}
                          dataKey="value" strokeWidth={0}
                        >
                          <Cell fill={theme.palette.primary.main} />
                          <Cell fill="#e0e0e0" />
                        </Pie>
                      </PieChart>
                      <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Typography sx={{ fontSize: "0.6rem", fontWeight: "bold", lineHeight: 1 }}>
                          {completedGoals}/{goals.length}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Regenerate today's suggested goals">
                    <Button
                      size="small" startIcon={<AutoAwesomeIcon />}
                      onClick={handleRefreshGoals} disabled={goalsLoading}
                    >
                      Refresh
                    </Button>
                  </Tooltip>
                  <Button size="small" startIcon={<AddIcon />} onClick={handleAddGoal} disabled={goalsLoading}>
                    Add
                  </Button>
                  <Button
                    size="small"
                    startIcon={deleteMode ? null : <DeleteSweepIcon />}
                    color={deleteMode ? "inherit" : "error"}
                    onClick={() => setDeleteMode((d) => !d)}
                    disabled={goalsLoading || goals.length === 0}
                  >
                    {deleteMode ? "Cancel" : "Delete"}
                  </Button>
                </Stack>
              </Stack>
            </Box>

            <Divider />

            {/* Column headers */}
            {goals.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  bgcolor: "action.hover",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                {/* drag handle column placeholder */}
                <Box sx={{ width: DRAG_W, flexShrink: 0 }} />
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1, px: 1 }}>
                  <Box sx={{ flexShrink: 0, minWidth: 60 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">Type</Typography>
                  </Box>
                  <Box sx={{ flexShrink: 0, minWidth: 44 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">Date</Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">Label</Typography>
                  </Box>
                  <Box sx={{ flexShrink: 0, minWidth: 36, textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">Target</Typography>
                  </Box>
                </Box>
                <Box
                  sx={{
                    width: RIGHT_W, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderLeft: "1px solid", borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">Progress</Typography>
                </Box>
              </Box>
            )}

            {/* Goal rows */}
            {goalsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : goals.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 4, px: 2 }}>
                <Typography color="text.secondary" gutterBottom>
                  No goals for today yet.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
                  <Button variant="contained" size="small" startIcon={<AutoAwesomeIcon />} onClick={handleRefreshGoals}>
                    Generate Goals
                  </Button>
                  <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleAddGoal}>
                    Add Manually
                  </Button>
                </Stack>
              </Box>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={goals.map((g) => g.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {goals.map((goal) => (
                    <SortableGoalRow
                      key={goal.id}
                      goal={goal}
                      onUpdate={handleUpdateGoal}
                      onDelete={handleDeleteGoal}
                      deleteMode={deleteMode}
                      autoFocus={goal.id === newGoalId}
                    />
                  ))}
                </SortableContext>

                {/* Drag overlay — renders a lifted clone that follows the cursor */}
                <DragOverlay dropAnimation={{
                  duration: 200,
                  easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
                }}>
                  {activeGoalId ? (() => {
                    const activeGoal = goals.find((g) => g.id === activeGoalId);
                    return activeGoal ? (
                      <GoalRow
                        goal={activeGoal}
                        onUpdate={() => {}}
                        onDelete={() => {}}
                        deleteMode={false}
                        isOverlay
                      />
                    ) : null;
                  })() : null}
                </DragOverlay>
              </DndContext>
            )}

            {/* All-done celebration */}
            {allGoalsDone && (
              <Box sx={{ p: 2 }}>
                <Alert severity="success">
                  Every goal done — you are absolutely incredible today! 🎉🎊
                </Alert>
              </Box>
            )}
          </Card>
        </Grid>

        {/* Focus widget */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>🎵 Focus Mode</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Load some background music to stay in the zone while you job hunt.
              </Typography>
              {currentVideoTitle ? (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" fontWeight="medium">Now playing:</Typography>
                  <Typography variant="body2" color="primary">{currentVideoTitle}</Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>No video loaded.</Typography>
              )}
              <Stack spacing={1}>
                <Button variant="contained" startIcon={<PlayCircleIcon />} onClick={loadRandomVideo} fullWidth>
                  {focusVideos.length > 0 ? "Load Random Video" : "Add Focus Videos →"}
                </Button>
                <Button variant="outlined" size="small" onClick={() => navigate("/focus")} fullWidth>
                  Manage Library
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
