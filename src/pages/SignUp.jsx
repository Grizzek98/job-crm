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

export default function SignUp({ onShowSignIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // With email confirmation on, Supabase returns a user with no identities
    // when the email is already registered (instead of an error).
    if (data.user && data.user.identities?.length === 0) {
      setError("An account with this email already exists. Try signing in.");
      return;
    }

    // If email confirmation is off, Supabase returns a session and
    // App's auth listener signs the user straight in.
    if (!data.session) {
      setCheckEmail(true);
    }
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
              Create an account
            </Typography>
          </Box>

          {checkEmail ? (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                Almost done! We sent a confirmation link to <b>{email}</b>.
                Click it to finish creating your account, then sign in.
              </Alert>
              <Button variant="contained" fullWidth onClick={onShowSignIn}>
                Back to sign in
              </Button>
            </>
          ) : (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSignUp}>
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  required
                  margin="normal"
                />
                <TextField
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  helperText={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  fullWidth
                  required
                  margin="normal"
                />
                <TextField
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                    "Create account"
                  )}
                </Button>
              </Box>

              <Typography variant="body2" align="center" sx={{ mt: 2 }}>
                Already have an account?{" "}
                <Link component="button" type="button" onClick={onShowSignIn}>
                  Sign in
                </Link>
              </Typography>
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
}
