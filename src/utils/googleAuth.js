/**
 * Google Identity Services (GIS) helpers — token model (implicit flow).
 * No server required; access tokens are stored in localStorage with expiry tracking.
 */

import { supabase } from "../supabaseClient";

const TOKEN_KEY  = "gcal_token";
const EXPIRY_KEY = "gcal_token_expiry";
// Calendar picks saved by Timeline.jsx (they include calendar IDs, often emails).
const SELECTED_CALENDARS_KEY = "gcal_selected_calendars";
// Which app account the Google data in this browser belongs to.
const OWNER_KEY = "gcal_owner_user_id";

// ─── localStorage helpers ─────────────────────────────────────────────────────

/** Returns a valid (non-expired) stored token, or null. */
export function getStoredToken() {
  try {
    const token  = localStorage.getItem(TOKEN_KEY);
    const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) ?? "0", 10);
    if (token && Date.now() < expiry) return token;
    return null;
  } catch {
    return null;
  }
}

/** Persists an access token with a 5-minute safety buffer on the expiry. */
export function storeToken(accessToken, expiresIn) {
  try {
    localStorage.setItem(TOKEN_KEY,  accessToken);
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + (expiresIn - 300) * 1000));
  } catch { /* ignore — storage quota or private mode */ }
}

/** Removes the stored token (call on disconnect or expiry). */
export function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  } catch { /* ignore */ }
}

/** Removes everything Google Calendar left in this browser. */
function clearAllCalendarData() {
  clearStoredToken();
  try {
    localStorage.removeItem(SELECTED_CALENDARS_KEY);
    localStorage.removeItem(OWNER_KEY);
  } catch { /* ignore */ }
}

// ─── Keep Google data with the account that connected it ──────────────────────
// The Google token lives in this browser, not in the account, so on a shared
// computer the next person to sign in could otherwise use the previous
// person's calendar. Clear it on sign-out, and also whenever a different
// account signs in (covers sessions that expired without a sign-out).
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    clearAllCalendarData();
    return;
  }
  const userId = session?.user?.id;
  if (!userId) return;
  try {
    const owner = localStorage.getItem(OWNER_KEY);
    if (owner && owner !== userId) clearAllCalendarData();
    localStorage.setItem(OWNER_KEY, userId);
  } catch { /* ignore */ }
});

// ─── GIS script loader ────────────────────────────────────────────────────────

/** Injects the GIS script once and resolves when the API is ready. */
function loadGisScript() {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (window.google?.accounts?.oauth2) { resolve(); return; }

    // Script tag already injected — poll until ready
    if (document.querySelector('script[src*="accounts.google.com/gsi"]')) {
      const t = setInterval(() => {
        if (window.google?.accounts?.oauth2) { clearInterval(t); resolve(); }
      }, 50);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

// ─── Token request ────────────────────────────────────────────────────────────

/**
 * Requests a Google Calendar read-only access token via a GIS popup.
 *
 * @param {object} opts
 * @param {(token: string) => void} opts.onSuccess  Called with the access token on success.
 * @param {(msg: string)  => void} opts.onError    Called with an error message on failure.
 * @param {"consent"|""}          opts.prompt      "consent" = always show screen; "" = silent if possible.
 */
export async function requestCalendarToken({ onSuccess, onError, prompt = "consent" }) {
  try {
    await loadGisScript();
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      callback: (response) => {
        if (response.error) {
          onError?.(response.error_description ?? response.error);
          return;
        }
        storeToken(response.access_token, response.expires_in);
        onSuccess?.(response.access_token);
      },
    });
    tokenClient.requestAccessToken({ prompt });
  } catch (err) {
    onError?.(err.message);
  }
}
