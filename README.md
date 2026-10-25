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

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. In Supabase Dashboard → Edge Functions → Secrets, set GEMINI_API_KEY to that key. Never put it in VITE_ variables or frontend code.
3. Optionally set GEMINI_MODEL to a model available to your API key. The function defaults to gemini-3.6-flash; this is configurable without changing the frontend.
4. Deploy supabase/functions/ai-note-assist/index.ts as the ai-note-assist Edge Function. Keep JWT verification enabled; the function validates the caller's session and enforces a per-account daily request quota.
5. The function uses Gemini's Interactions API with store=false, so it does not request persistent interaction history. Google still processes the submitted text to return a result; review Google's terms and data handling before sending sensitive notes.

The AI function accepts only four actions: explain, improve, summarize, and generate. It limits input lengths and request duration. It does not write note content or model output to an application table or log; only action metadata is stored for quotas. Submitted text is sent to the external AI provider, so don't submit sensitive material unless you're comfortable with the provider's terms.

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
