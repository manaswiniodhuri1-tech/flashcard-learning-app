const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key || url.includes("YOUR-PROJECT-REF") || key.startsWith("replace_with_") || key.startsWith("your-server-side")) {
  console.warn("Supabase credentials are missing or still placeholders. Add real values to backend/.env.");
}

const supabase = createClient(url || "https://placeholder.supabase.co", key || "placeholder-key", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

module.exports = supabase;
