# NoteLink

A personal knowledge workspace for capturing atomic notes and making relationships between ideas explicit.

The original NoteLink used a React frontend, Spring Boot API, MySQL, custom JWT authentication, and a force-directed graph. This rework keeps the core idea—notes as connected ideas—while reducing operational complexity with Supabase.

## MVP features

- Private notes with title, plain-text/Markdown-friendly content, category, color, and pinning.
- Directional, labeled links between notes and automatically derived backlinks.
- Search across titles, content, and categories.
- A selectable knowledge graph.
- Supabase email/password authentication and PostgreSQL Row Level Security.
- Optional AI actions: explain, improve, summarize, or draft a note from a short prompt. AI results are drafts and are never saved automatically.
- JSON export of notes and relationships.

Not included in the first release: collaboration, public sharing, rich-text editing, file attachments, folders, vector search, autonomous agents, or AI conversation history.

## Technology

- React + TypeScript + Vite
- Supabase Auth + PostgreSQL + Row Level Security
- One Supabase Edge Function for AI requests
- Google Gemini Interactions API for optional AI assistance
- Vitest unit tests

There is no separate Express/Spring API. Normal note operations use supabase-js and are restricted by database RLS.

## Local setup

1. Install Node.js 20.19+ or 22.12+.
2. Clone this repository and run npm install.
3. Copy .env.example to .env.local. The example is preconfigured with this project's public URL and publishable key.
4. Never use a secret/service-role key in browser code. The publishable key is intentionally designed for browser use; RLS still enforces row access.
5. In Supabase Dashboard → Authentication → URL Configuration, add http://localhost:5173 to allowed redirect URLs if required by your Auth settings.
6. Apply the SQL migration in supabase/migrations/ to your Supabase project. The initial migration for this project is also applied in the hosted development database.
7. Run npm run dev and open the URL shown by Vite.

Required local environment variables:

    VITE_SUPABASE_URL=https://your-project-ref.supabase.co
    VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

If local Supabase settings are missing, the app shows an in-app setup page rather than crashing.

## AI setup

AI is optional. The rest of the app works without an AI provider key.

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey). In Supabase Dashboard → Edge Functions → Secrets, set GEMINI_API_KEY. Never put provider keys in VITE_ variables or frontend code.
2. Optionally create a [Groq API key](https://console.groq.com/keys) and set GROQ_API_KEY in the same Supabase Edge Function Secrets page. Groq is used once as a backup when Gemini fails or returns an incomplete draft. If GROQ_API_KEY is absent, the function still works with Gemini alone.
3. The default primary model is gemini-3.8-flash. Override it with GEMINI_MODEL only when needed. The default fallback model is openai/gpt-oss-20b; override it with GROQ_MODEL if required.
4. Deploy supabase/functions/ai-note-assist/index.ts and keep JWT verification enabled. The function validates the caller's session and enforces one per-account daily quota across both providers; a successful fallback counts as one AI action.
5. Gemini requests use the Interactions API with store=false. Groq requests use its OpenAI-compatible Chat Completions API. Both providers process submitted text to generate an answer, so review their terms and data-handling policies before sending sensitive notes.
6. Generated notes must include a Markdown title and a sufficiently complete body. Incomplete Gemini interactions, output-limit truncation, and invalid short generated notes are rejected; the function attempts one Groq fallback rather than saving a fragment.

The AI function accepts only four actions: explain, improve, summarize, and generate. It limits input lengths and each provider request to 18 seconds. It never logs note text or generated output; only action metadata is stored for quotas. Gemini is tried first when configured, then Groq is attempted at most once after a provider failure or incomplete result. A successful fallback is still counted as one AI action. Free-tier limits and availability are provider-specific, and either provider can be temporarily unavailable.

## Data security

- Schema changes belong in supabase/migrations and must be reviewed.
- All user-facing tables enable RLS.
- Notes are scoped to the signed-in Supabase user.
- Composite foreign keys include the owner ID and each note ID to prevent cross-user links, even if someone guesses a UUID.
- ai_usage is server-only and contains metadata only, never note text or generated output.
- Never commit .env.local, provider keys, database passwords, or Supabase secret/service-role keys.

## Quality checks

    npm run typecheck
    npm run test
    npm run build

See docs/BUILD_PLAN.md for architecture and next milestones.
