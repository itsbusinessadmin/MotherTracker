// Supabase connection. Find both values in your Supabase dashboard:
// Project Settings → API → "Project URL" and the "anon public" key.
// The anon key is meant to be public; the database rules in supabase/schema.sql
// are what keep non-editors from changing anything.
//
// Leave the placeholders in place to run the app in local-only mode
// (edits are kept on that one device).
window.CE_CONFIG = {
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  pageId: 'main'
};
