import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// A password-reset email link lands here with "type=recovery" in the URL hash.
// Read it before createClient, which clears the hash once it has used it.
export const openedFromPasswordResetLink = /type=recovery/.test(window.location.hash);

export const supabase = createClient(supabaseUrl, supabaseKey);
