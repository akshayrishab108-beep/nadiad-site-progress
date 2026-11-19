// Hosted production builds must carry the backend config. Fail the build
// rather than publish an unauthenticated local-only site.
const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(k => !process.env[k]);
if (missing.length) {
    console.error('Hosted build requires env: ' + missing.join(', '));
    process.exit(1);
}
