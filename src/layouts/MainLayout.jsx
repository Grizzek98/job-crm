import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  useMediaQuery,
  useTheme,
  Paper,
  Tooltip,
  Snackbar,
  Alert,
  Chip,
  Slider,
  Popover,
  InputAdornment,
  CircularProgress,
  TextField,
} from "@mui/material";
import DashboardIcon       from "@mui/icons-material/Dashboard";
import BarChartIcon        from "@mui/icons-material/BarChart";
import TableChartIcon      from "@mui/icons-material/TableChart";
import CalendarMonthIcon   from "@mui/icons-material/CalendarMonth";
import AddBoxIcon          from "@mui/icons-material/AddBox";
import BusinessIcon        from "@mui/icons-material/Business";
import WorkIcon            from "@mui/icons-material/Work";
import PeopleIcon          from "@mui/icons-material/People";
import DescriptionIcon     from "@mui/icons-material/Description";
import EventIcon           from "@mui/icons-material/Event";
import SelfImprovementIcon from "@mui/icons-material/SelfImprovement";
import OpenInNewIcon       from "@mui/icons-material/OpenInNew";
import SettingsIcon        from "@mui/icons-material/Settings";
import MenuIcon            from "@mui/icons-material/Menu";
import LogoutIcon          from "@mui/icons-material/Logout";
import TimerIcon           from "@mui/icons-material/Timer";
import CloseIcon           from "@mui/icons-material/Close";
import PlayArrowIcon       from "@mui/icons-material/PlayArrow";
import PauseIcon           from "@mui/icons-material/Pause";
import RestartAltIcon      from "@mui/icons-material/RestartAlt";
import DragIndicatorIcon   from "@mui/icons-material/DragIndicator";
import ChevronLeftIcon     from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon    from "@mui/icons-material/ChevronRight";
import VolumeUpIcon        from "@mui/icons-material/VolumeUp";
import VolumeDownIcon      from "@mui/icons-material/VolumeDown";
import VolumeOffIcon       from "@mui/icons-material/VolumeOff";
import SearchIcon          from "@mui/icons-material/Search";
import confetti            from "canvas-confetti";
import { NotificationProvider } from "../context/NotificationContext";
import { globalSearch } from "../services/searchService";
import { FocusProvider, useFocus } from "../context/FocusContext";
import { extractYouTubeId } from "../utils/youtube";

const DRAWER_WIDTH           = 220;
const DRAWER_COLLAPSED_WIDTH = 60;
const SIDEBAR_STORAGE_KEY    = "sidebarCollapsed";

const group1 = [
  { label: "Dashboard",  path: "/",        icon: <DashboardIcon /> },
  { label: "Job Stats",  path: "/stats",   icon: <BarChartIcon /> },
  { label: "CRM",        path: "/crm",     icon: <TableChartIcon /> },
  { label: "Timeline",   path: "/timeline",icon: <CalendarMonthIcon /> },
  { label: "Add Job",    path: "/add-job", icon: <AddBoxIcon /> },
];

const group2 = [
  { label: "Companies",    path: "/companies", icon: <BusinessIcon /> },
  { label: "Positions",    path: "/positions", icon: <WorkIcon /> },
  { label: "Contacts",     path: "/contacts",  icon: <PeopleIcon /> },
  { label: "Documents",    path: "/documents", icon: <DescriptionIcon /> },
  { label: "Events",       path: "/events",    icon: <EventIcon /> },
  { label: "Focus Tools",  path: "/focus",     icon: <SelfImprovementIcon /> },
  { label: "Job Sites",    path: "/job-sites", icon: <OpenInNewIcon /> },
  { label: "Settings",     path: "/settings",  icon: <SettingsIcon /> },
];

// ─── Nav group ───────────────────────────────────────────────────────────────
function NavGroup({ items, onClose, collapsed }) {
  return (
    <List sx={{ pt: 0 }}>
      {items.map(({ label, path, icon }) => (
        <ListItem key={path} disablePadding>
          <Tooltip title={collapsed ? label : ""} placement="right" arrow>
            <ListItemButton
              component={NavLink}
              to={path}
              end={path === "/"}
              onClick={onClose}
              sx={{
                mx: collapsed ? 0.5 : 1,
                borderRadius: 1,
                justifyContent: collapsed ? "center" : "flex-start",
                minHeight: 44,
                "&.active": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "& .MuiListItemIcon-root": { color: "primary.contrastText" },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? 0 : 36,
                  justifyContent: "center",
                }}
              >
                {icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={label}
                  slotProps={{ primary: { fontSize: 14 } }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      ))}
    </List>
  );
}

// ─── Sidebar global search ───────────────────────────────────────────────────
function SidebarSearch({ collapsed, onExpand }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const anchorRef = useRef(null);
  const inputRef  = useRef(null);
  const debounceRef = useRef(null);

  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState(null); // null = no search yet
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searching,   setSearching]   = useState(false);

  // Close + clear whenever the route changes
  useEffect(() => {
    setPopoverOpen(false);
    setQuery("");
    setResults(null);
  }, [location.pathname, location.search]);

  // Debounced search — fires 300 ms after the user stops typing
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setResults(null);
      setPopoverOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await globalSearch(query);
        setResults(r);
        const total = r.companies.length + r.positions.length + r.contacts.length;
        setPopoverOpen(total > 0);
      } catch { /* silent — search is best-effort */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function goTo(name, section) {
    const params = new URLSearchParams({ search: name });
    if (section) params.set("section", section);
    navigate(`/crm?${params.toString()}`);
  }

  // Icon-only when sidebar is collapsed
  if (collapsed) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
        <Tooltip title="Search" placement="right" arrow>
          <IconButton
            size="small"
            onClick={() => {
              onExpand();
              // Wait for the sidebar transition before focusing
              setTimeout(() => inputRef.current?.focus(), 220);
            }}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  const hasResults = results &&
    (results.companies.length + results.positions.length + results.contacts.length) > 0;

  return (
    <Box ref={anchorRef} sx={{ px: 1, py: 0.75 }}>
      <TextField
        inputRef={inputRef}
        size="small"
        fullWidth
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (hasResults) setPopoverOpen(true); }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                {searching
                  ? <CircularProgress size={13} />
                  : <SearchIcon sx={{ fontSize: 16, color: "text.secondary" }} />}
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  edge="end"
                  onClick={() => { setQuery(""); setResults(null); setPopoverOpen(false); }}
                  sx={{ p: 0.25 }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: 13 } }}
      />

      <Popover
        open={popoverOpen}
        anchorEl={anchorRef.current}
        onClose={() => setPopoverOpen(false)}
        disableAutoFocus
        disableEnforceFocus
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              width: anchorRef.current?.offsetWidth ?? DRAWER_WIDTH,
              mt: 0.5,
              maxHeight: 380,
              overflow: "auto",
            },
          },
        }}
      >
        {results?.companies.length > 0 && (
          <>
            <Typography variant="caption" sx={{ px: 1.5, pt: 1, pb: 0.25, display: "block", color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Companies
            </Typography>
            <List dense disablePadding>
              {results.companies.map((c) => (
                <ListItemButton key={c.id} onClick={() => goTo(c.name, "companies")} sx={{ px: 1.5, py: 0.5 }}>
                  <ListItemText primary={c.name} slotProps={{ primary: { fontSize: 13 } }} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}

        {results?.positions.length > 0 && (
          <>
            <Typography variant="caption" sx={{ px: 1.5, pt: 1, pb: 0.25, display: "block", color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Positions
            </Typography>
            <List dense disablePadding>
              {results.positions.map((p) => (
                <ListItemButton key={p.id} onClick={() => goTo(p.name, "positions")} sx={{ px: 1.5, py: 0.5 }}>
                  <ListItemText
                    primary={p.name}
                    secondary={p.companies?.name}
                    slotProps={{ primary: { fontSize: 13 }, secondary: { fontSize: 11 } }}
                  />
                </ListItemButton>
              ))}
            </List>
          </>
        )}

        {results?.contacts.length > 0 && (
          <>
            <Typography variant="caption" sx={{ px: 1.5, pt: 1, pb: 0.25, display: "block", color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Contacts
            </Typography>
            <List dense disablePadding>
              {results.contacts.map((ct) => (
                <ListItemButton key={ct.id} onClick={() => goTo(ct.name, "contacts")} sx={{ px: 1.5, py: 0.5 }}>
                  <ListItemText
                    primary={ct.name}
                    secondary={[ct.title, ct.companies?.name].filter(Boolean).join(" · ")}
                    slotProps={{ primary: { fontSize: 13 }, secondary: { fontSize: 11 } }}
                  />
                </ListItemButton>
              ))}
            </List>
          </>
        )}

        <Divider sx={{ mt: 0.5 }} />
        <ListItemButton
          onClick={() => { navigate(`/crm?search=${encodeURIComponent(query)}`); setPopoverOpen(false); }}
          sx={{ px: 1.5, py: 0.75 }}
        >
          <ListItemText
            primary={`See all results for "${query}" in CRM →`}
            slotProps={{ primary: { fontSize: 12, color: "primary.main", fontWeight: 500 } }}
          />
        </ListItemButton>
      </Popover>
    </Box>
  );
}

// ─── YouTube mini-player (IFrame Player API for volume control) ───────────────
function YouTubePlayer() {
  const { currentVideo, setCurrentVideo } = useFocus();
  const playerRef  = useRef(null); // YT.Player instance
  const wrapperRef = useRef(null); // DOM container we own
  const [volume, setVolume] = useState(80);
  const [muted,  setMuted]  = useState(false);
  const volumeRef = useRef(80); // stable ref for API callbacks

  // Inject the IFrame API script once; destroy player on unmount
  useEffect(() => {
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag  = document.createElement("script");
      tag.src    = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    return () => {
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, []);

  // Create player or load a new video when currentVideo changes
  useEffect(() => {
    if (!currentVideo) {
      try { playerRef.current?.stopVideo(); } catch { /* ignore */ }
      return;
    }
    const videoId = extractYouTubeId(currentVideo.url);
    if (!videoId) return;

    function go() {
      // If the player already exists, just swap the video — no re-creation needed
      if (playerRef.current) {
        try { playerRef.current.loadVideoById(videoId); return; } catch { /* fall through to recreate */ }
      }
      // First load (or after an error): clear wrapper and mount a fresh inner div
      if (!wrapperRef.current) return;
      wrapperRef.current.innerHTML = "";
      const target = document.createElement("div");
      wrapperRef.current.appendChild(target);
      playerRef.current = new window.YT.Player(target, {
        height: "130",
        width:  "220",
        videoId,
        playerVars: { autoplay: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: (e) => { e.target.setVolume(volumeRef.current); },
        },
      });
    }

    if (window.YT?.Player) {
      go();
    } else {
      // API not loaded yet — queue up behind any existing callback
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); go(); };
    }
  }, [currentVideo]);

  // Keep volume / mute in sync with the live player
  useEffect(() => {
    volumeRef.current = volume;
    try {
      if (!playerRef.current) return;
      playerRef.current.setVolume(volume);
      muted ? playerRef.current.mute() : playerRef.current.unMute();
    } catch { /* player not ready yet — onReady will pick up volumeRef */ }
  }, [volume, muted]);

  return (
    <Paper
      elevation={6}
      sx={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 1300,
        width: 220,
        overflow: "hidden",
        borderRadius: 2,
        display: currentVideo ? "flex" : "none",
        flexDirection: "column",
      }}
    >
      {/* IFrame API replaces contents of this div with an <iframe> */}
      <Box ref={wrapperRef} sx={{ width: 220, height: 130, flexShrink: 0, bgcolor: "black" }} />

      {/* Title + stop */}
      <Box sx={{ px: 1, pt: 0.5, pb: 0.25, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="caption" noWrap sx={{ maxWidth: 150 }}>
          {currentVideo?.title ?? ""}
        </Typography>
        <Tooltip title="Stop">
          <IconButton size="small" onClick={() => setCurrentVideo(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Volume row */}
      <Box sx={{ px: 1, pb: 0.75, display: "flex", alignItems: "center", gap: 0.5 }}>
        <IconButton size="small" onClick={() => setMuted((m) => !m)} sx={{ p: 0.25 }}>
          {muted || volume === 0
            ? <VolumeOffIcon  fontSize="small" />
            : volume < 50
            ? <VolumeDownIcon fontSize="small" />
            : <VolumeUpIcon   fontSize="small" />}
        </IconButton>
        <Slider
          size="small"
          value={muted ? 0 : volume}
          onChange={(_, v) => { setMuted(false); setVolume(v); }}
          min={0}
          max={100}
          sx={{ flexGrow: 1, mx: 0.5 }}
        />
      </Box>
    </Paper>
  );
}

// ─── Pomodoro sound (Web Audio API, no external files) ───────────────────────
function playPhaseChime(toPhase) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = toPhase === "break"
      ? [[523, 0], [659, 0.18], [784, 0.36]] // C5 → E5 → G5 (ascending)
      : [[784, 0], [659, 0.18], [523, 0.36]]; // G5 → E5 → C5 (descending, reverse)

    notes.forEach(([freq, delay]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.55);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.6);
    });
  } catch {
    // AudioContext blocked or unsupported — silently ignore
  }
}

// ─── Pomodoro timer ──────────────────────────────────────────────────────────
function PomodoroTimer() {
  const theme = useTheme();
  const {
    timerVisible, timerPhase, timerRunning, timerSecondsLeft,
    pomodoroCount, startPause, resetTimer,
  } = useFocus();

  const [pos, setPos]           = useState({ x: 16, y: null });
  const [dragging, setDragging] = useState(false);
  const dragStart               = useRef(null);
  const paperRef                = useRef(null); // ref to the timer Paper for confetti origin
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg,  setSnackMsg]  = useState("");
  const prevPhase = useRef(timerPhase);

  // Detect phase transitions → sound + snack + confetti
  useEffect(() => {
    if (prevPhase.current !== timerPhase) {
      if (timerPhase === "break") {
        // Work phase just completed — burst from wherever the timer box is sitting
        playPhaseChime("break");
        const rect = paperRef.current?.getBoundingClientRect();
        const origin = rect
          ? { x: (rect.left + rect.width  / 2) / window.innerWidth,
              y: (rect.top  + rect.height / 2) / window.innerHeight }
          : { y: 0.55 };
        confetti({ particleCount: 80, spread: 70, startVelocity: 45, angle: 60,  origin });
        confetti({ particleCount: 80, spread: 70, startVelocity: 45, angle: 120, origin });
        setSnackMsg("Work phase done! Take a well-earned break 🎉");
      } else {
        // Break just ended
        playPhaseChime("work");
        setSnackMsg("Break's over — back to it! You got this 💪");
      }
      setSnackOpen(true);
      prevPhase.current = timerPhase;
    }
  }, [timerPhase]);

  const mins = String(Math.floor(timerSecondsLeft / 60)).padStart(2, "0");
  const secs = String(timerSecondsLeft % 60).padStart(2, "0");

  function onMouseDown(e) {
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y ?? (window.innerHeight - 200) };
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e) {
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      setPos({ x: Math.max(0, dragStart.current.px + dx), y: Math.max(0, dragStart.current.py + dy) });
    }
    function onUp() { setDragging(false); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  if (!timerVisible) return null;

  // Phase colors from theme
  const headerBg = timerPhase === "work"
    ? theme.palette.primary.main
    : theme.palette.secondary.main;

  return (
    <>
      <Paper
        ref={paperRef}
        elevation={6}
        sx={{
          position: "fixed",
          bottom: pos.y === null ? 16 : undefined,
          top:    pos.y !== null ? pos.y : undefined,
          left: pos.x,
          zIndex: 1300,
          width: 180,
          borderRadius: 2,
          overflow: "hidden",
          userSelect: "none",
        }}
      >
        {/* Drag handle / phase header */}
        <Box
          onMouseDown={onMouseDown}
          sx={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            px: 1, py: 0.5,
            bgcolor: headerBg,
            color: "white",
            cursor: "grab",
            transition: "background-color 0.4s ease",
          }}
        >
          <DragIndicatorIcon fontSize="small" />
          <Typography variant="caption" fontWeight="bold">
            {timerPhase === "work" ? "Work" : "Break"}
          </Typography>
          {pomodoroCount > 0 && (
            <Chip
              label={pomodoroCount}
              size="small"
              sx={{ height: 18, fontSize: 10, bgcolor: "rgba(255,255,255,0.3)", color: "white" }}
            />
          )}
        </Box>

        {/* Countdown */}
        <Box sx={{ textAlign: "center", py: 1.5 }}>
          <Typography variant="h4" fontWeight="bold" fontFamily="monospace">
            {mins}:{secs}
          </Typography>
        </Box>

        {/* Controls */}
        <Box sx={{ display: "flex", justifyContent: "center", gap: 1, pb: 1.5 }}>
          <Tooltip title={timerRunning ? "Pause" : "Start"}>
            <IconButton size="small" onClick={startPause} color="primary">
              {timerRunning ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset">
            <IconButton size="small" onClick={resetTimer}>
              <RestartAltIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      <Snackbar
        open={snackOpen}
        autoHideDuration={5000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="info" onClose={() => setSnackOpen(false)}>{snackMsg}</Alert>
      </Snackbar>
    </>
  );
}

// ─── Session time tracker ─────────────────────────────────────────────────────
function SessionTracker({ settings }) {
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg,  setSnackMsg]  = useState("");
  const minutesRef   = useRef(0);
  const nextAlertRef = useRef(null);

  useEffect(() => {
    if (!settings?.session_tracker_enabled) return;

    const intervalMin = settings?.session_tracker_interval_min ?? 30;
    const todayKey    = `session_${new Date().toISOString().split("T")[0]}`;
    const stored      = parseInt(localStorage.getItem(todayKey) ?? "0", 10);
    minutesRef.current   = stored;
    nextAlertRef.current = stored + intervalMin;

    const tick = setInterval(() => {
      minutesRef.current += 1;
      localStorage.setItem(todayKey, String(minutesRef.current));

      if (minutesRef.current >= nextAlertRef.current) {
        nextAlertRef.current += intervalMin;
        const msgs = [
          `You've been job hunting for ${minutesRef.current} minutes today! Amazing dedication! 🔥`,
          `${minutesRef.current} minutes of job searching — you're crushing it! 💪`,
          `Wow, ${minutesRef.current} minutes in! You're an absolute rockstar. Keep going! ⭐`,
        ];
        setSnackMsg(msgs[Math.floor(Math.random() * msgs.length)]);
        setSnackOpen(true);
      }
    }, 60_000);

    return () => clearInterval(tick);
  }, [settings?.session_tracker_enabled, settings?.session_tracker_interval_min]);

  return (
    <Snackbar
      open={snackOpen}
      autoHideDuration={8000}
      onClose={() => setSnackOpen(false)}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert severity="success" onClose={() => setSnackOpen(false)}>{snackMsg}</Alert>
    </Snackbar>
  );
}

// ─── Focus timer toggle (sidebar button) ─────────────────────────────────────
function FocusTimerToggle({ collapsed }) {
  const { timerVisible, toggleTimer } = useFocus();
  return (
    <List>
      <ListItem disablePadding>
        <Tooltip title={collapsed ? "Focus Timer" : ""} placement="right" arrow>
          <ListItemButton
            onClick={toggleTimer}
            sx={{
              mx: collapsed ? 0.5 : 1,
              borderRadius: 1,
              justifyContent: collapsed ? "center" : "flex-start",
              minHeight: 44,
              bgcolor: timerVisible ? "primary.light" : undefined,
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, justifyContent: "center" }}>
              <TimerIcon color={timerVisible ? "primary" : "inherit"} />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText primary="Focus Timer" slotProps={{ primary: { fontSize: 14 } }} />
            )}
          </ListItemButton>
        </Tooltip>
      </ListItem>
    </List>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────
export default function MainLayout({ settings, onSettingsChange }) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  // Sidebar collapse — persisted to localStorage
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
  );

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const drawerWidth = collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflowX: "hidden" }}>
      {/* Logo */}
      <Toolbar
        sx={{
          minHeight: 56,
          justifyContent: collapsed ? "center" : "flex-start",
          px: collapsed ? 0 : 2,
        }}
      >
        <WorkIcon sx={{ color: "primary.main", mr: collapsed ? 0 : 1, flexShrink: 0 }} />
        {!collapsed && (
          <Typography variant="subtitle1" fontWeight="bold" noWrap>
            Job CRM
          </Typography>
        )}
      </Toolbar>

      <Divider />

      {/* Global search */}
      <SidebarSearch collapsed={collapsed} onExpand={() => setCollapsed(false)} />

      {/* Group 1 — Daily Use */}
      <Box sx={{ pt: collapsed ? 1 : 0 }}>
        {!collapsed && (
          <Typography
            variant="caption"
            sx={{ px: 2, color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Daily
          </Typography>
        )}
        <NavGroup items={group1} onClose={() => setMobileOpen(false)} collapsed={collapsed} />
      </Box>

      <Divider sx={{ mx: collapsed ? 0 : 1 }} />

      {/* Group 2 — Data Management */}
      <Box sx={{ pt: 1, flexGrow: 1, overflowY: "auto" }}>
        {!collapsed && (
          <Typography
            variant="caption"
            sx={{ px: 2, color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Data
          </Typography>
        )}
        <NavGroup items={group2} onClose={() => setMobileOpen(false)} collapsed={collapsed} />
      </Box>

      <Divider />

      {/* Bottom: timer toggle + logout */}
      <FocusTimerToggle collapsed={collapsed} />

      <List>
        <ListItem disablePadding>
          <Tooltip title={collapsed ? "Sign Out" : ""} placement="right" arrow>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                mx: collapsed ? 0.5 : 1,
                borderRadius: 1,
                justifyContent: collapsed ? "center" : "flex-start",
                minHeight: 44,
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, justifyContent: "center" }}>
                <LogoutIcon />
              </ListItemIcon>
              {!collapsed && (
                <ListItemText primary="Sign Out" slotProps={{ primary: { fontSize: 14 } }} />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>

      {/* Collapse toggle */}
      <Divider />
      <Box sx={{ display: "flex", justifyContent: "center", py: 0.75 }}>
        <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="right">
          <IconButton size="small" onClick={toggleCollapsed}>
            {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <NotificationProvider>
      <FocusProvider settings={settings}>
        <Box sx={{ display: "flex" }}>
          {/* Mobile top bar */}
          {isMobile && (
            <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
              <Toolbar>
                <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2 }}>
                  <MenuIcon />
                </IconButton>
                <Typography variant="h6" noWrap>Job CRM</Typography>
              </Toolbar>
            </AppBar>
          )}

          {/* Sidebar */}
          <Drawer
            variant={isMobile ? "temporary" : "permanent"}
            open={isMobile ? mobileOpen : true}
            onClose={() => setMobileOpen(false)}
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              transition: "width 0.2s ease",
              "& .MuiDrawer-paper": {
                width: drawerWidth,
                boxSizing: "border-box",
                overflowX: "hidden",
                transition: "width 0.2s ease",
              },
            }}
          >
            {drawerContent}
          </Drawer>

          {/* Main content */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: 3,
              mt: isMobile ? 8 : 0,
              minHeight: "100vh",
              bgcolor: "background.default",
              transition: "margin 0.2s ease",
            }}
          >
            <Outlet />
          </Box>

          {/* Floating overlays */}
          <YouTubePlayer />
          <PomodoroTimer />
          <SessionTracker settings={settings} />
        </Box>
      </FocusProvider>
    </NotificationProvider>
  );
}
