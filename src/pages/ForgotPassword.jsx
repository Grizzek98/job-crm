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

export default function ForgotPassword({ onShowSignIn }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + import.meta.env.BASE_URL,
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    // Same message whether or not the email has an account, so the form
    // can't be used to find out who has signed up.
    setSent(true);
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
              Reset your password
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {sent ? (
            <Alert severity="success">
              If an account exists for <strong>{email}</strong>, we've sent a
              link to reset the password. Check your inbox (and spam folder).
            </Alert>
          ) : (
            <Box component="form" onSubmit={handleSubmit}>
              <Typography variant="body2" color="text.secondary">
                Enter the email you signed up with and we'll send you a link
                to choose a new password.
              </Typography>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                margin="normal"
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
                  "Send reset link"
                )}
              </Button>
            </Box>
          )}

          <Typography variant="body2" align="center" sx={{ mt: 2 }}>
            Remembered it?{" "}
            <Link component="button" type="button" onClick={onShowSignIn}>
              Back to sign in
            </Link>
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
