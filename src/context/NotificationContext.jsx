import { createContext, useContext, useState, useCallback } from "react";
import { Snackbar, Alert } from "@mui/material";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notification, setNotification] = useState(null);

  const notify = useCallback((message, severity = "error") => {
    setNotification({ message, severity });
  }, []);

  const handleClose = (_, reason) => {
    if (reason === "clickaway") return;
    setNotification(null);
  };

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={notification?.severity ?? "error"}
          onClose={handleClose}
          variant="filled"
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  return useContext(NotificationContext);
}
