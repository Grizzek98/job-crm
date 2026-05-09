import { useEffect, useState } from "react";
import { Box, CircularProgress, Alert } from "@mui/material";
import { Routes, Route } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Login from "./pages/Login";
import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Positions from "./pages/Positions";
import Applications from "./pages/Applications";
import Contacts from "./pages/Contacts";
import Documents from "./pages/Documents";

const AUTH_TIMEOUT_MS = 6000;

export default function App() {
  const [session, setSession] = useState(undefined);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      setSession(session);
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

  if (session === undefined) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (connectionError) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Alert severity="error">
          Could not connect to the server.
          <br />
          Is the database paused?
        </Alert>
      </Box>
    );
  }

  if (session === null) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="positions" element={<Positions />} />
        <Route path="applications" element={<Applications />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="documents" element={<Documents />} />
      </Route>
    </Routes>
  );
}
