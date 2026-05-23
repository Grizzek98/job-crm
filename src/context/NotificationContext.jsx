import { createContext, useContext, useState, useCallback } from "react";
import { Snackbar, Alert } from "@mui/material";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [errorNote,   setErrorNote]   = useState(null); // anchor: top-center
  const [generalNote, setGeneralNote] = useState(null); // anchor: bottom-center

  const notify = useCallback((message, severity = "error") => {
    if (severity === "error") {
      setErrorNote({ message, severity });
    } else {
      setGeneralNote({ message, severity });
    }
  }, []);

  return (
    <NotificationContext.Provider value={notify}>
      {children}

      {/* Error toasts — top-center, standard red */}
      <Snackbar
        open={!!errorNote}
        autoHideDuration={6000}
        onClose={(_, reason) => { if (reason !== "clickaway") setErrorNote(null); }}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity="error"
          onClose={() => setErrorNote(null)}
          variant="filled"
        >
          {errorNote?.message}
        </Alert>
      </Snackbar>

      {/* Non-error toasts — bottom-center, primary-color background */}
      <Snackbar
        open={!!generalNote}
        autoHideDuration={6000}
        onClose={(_, reason) => { if (reason !== "clickaway") setGeneralNote(null); }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={generalNote?.severity ?? "info"}
          onClose={() => setGeneralNote(null)}
          variant="filled"
          sx={{
            bgcolor: "primary.main",
            color: "primary.contrastText",
            "& .MuiAlert-icon":  { color: "primary.contrastText" },
            "& .MuiAlert-action": { color: "primary.contrastText" },
          }}
        >
          {generalNote?.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  return useContext(NotificationContext);
}
