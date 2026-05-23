import { useEffect, useState, useMemo } from "react";
import { Box, CircularProgress, Alert, createTheme, ThemeProvider, CssBaseline } from "@mui/material";
import { Routes, Route } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Login from "./pages/Login";
import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Positions from "./pages/Positions";
import Contacts from "./pages/Contacts";
import Documents from "./pages/Documents";
import Crm from "./pages/Crm";
import Stats from "./pages/Stats";
import Timeline from "./pages/Timeline";
import AddJob from "./pages/AddJob";
import Events from "./pages/Events";
import Focus from "./pages/Focus";
import JobSites from "./pages/JobSites";
import Settings from "./pages/Settings";
import { getSettings } from "./services/settingsService";

const AUTH_TIMEOUT_MS = 6000;

export default function App() {
  const [session, setSession] = useState(undefined);
  const [connectionError, setConnectionError] = useState(false);
  const [settings, setSettings] = useState(null);

  // Build MUI theme from user settings
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          primary:   { main: settings?.theme_primary   ?? "#1976d2" },
          secondary: { main: settings?.theme_secondary ?? "#9c27b0" },
          ...(settings?.theme_background
            ? { background: { default: settings.theme_background } }
            : {}),
        },
      }),
    [settings?.theme_primary, settings?.theme_secondary, settings?.theme_background],
  );

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      setSession(session);
      if (session) loadSettings();
    });

    async function checkConnection() {
      try {
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), AUTH_TIMEOUT_MS),
        );

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          const { error } = await Promise.race([
            supabase.auth.getUser(),
            timeout,
          ]);
          if (error) {
            setConnectionError(true);
            setSession(null);
            return;
          }
          loadSettings();
        }
        setSession(session);
      } catch {
        setConnectionError(true);
        setSession(null);
      }
    }
    checkConnection();

    return () => data?.subscription?.unsubscribe();
  }, []);

  async function loadSettings() {
    try {
      const s = await getSettings();
      setSettings(s);
    } catch {
      // Non-fatal — app works with defaults
    }
  }

  if (session === undefined) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (connectionError) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Alert severity="error">
          Could not connect to the server.
          <br />
          Is the database paused?
        </Alert>
      </Box>
    );
  }

  if (session === null) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<MainLayout settings={settings} onSettingsChange={setSettings} />}>
          <Route index element={<Dashboard />} />
          <Route path="stats" element={<Stats />} />
          <Route path="crm" element={<Crm />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="add-job" element={<AddJob />} />
          <Route path="companies" element={<Companies />} />
          <Route path="positions" element={<Positions />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="documents" element={<Documents />} />
          <Route path="events" element={<Events />} />
          <Route path="focus" element={<Focus />} />
          <Route path="job-sites" element={<JobSites />} />
          <Route path="settings" element={<Settings settings={settings} onSettingsChange={setSettings} />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}
