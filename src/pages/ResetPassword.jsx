import { supabase } from "../supabaseClient";
import { useState } from "react";

import WorkIcon from "@mui/icons-material/Work";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Link,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

const MIN_PASSWORD_LENGTH = 6;

// Shown after someone opens the link from a "reset your password" email.
// Supabase has already signed them in with a short-lived recovery session.
export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    onDone();
  };

  const handleCancel = async () => {
    await supabase.auth.signOut();
    onDone();
  };

  return (
    <Container maxWidth="xs">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              mb: 3,
            }}
          >
            <WorkIcon sx={{ fontSize: 40, mb: 1, color: "primary.main" }} />
            <Typography variant="h5" fontWeight="bold">
              Choose a new password
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              margin="normal"
              helperText={`At least ${MIN_PASSWORD_LENGTH} characters`}
              autoComplete="new-password"
            />
            <TextField
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
              required
              margin="normal"
              autoComplete="new-password"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{ mt: 3 }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Save new password"
              )}
            </Button>
          </Box>

          <Typography variant="body2" align="center" sx={{ mt: 2 }}>
            <Link component="button" type="button" onClick={handleCancel}>
              Cancel and sign out
            </Link>
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
