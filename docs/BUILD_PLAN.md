# NoteLink build plan

## Product contract

NoteLink is a private personal knowledge workspace. Notes are atomic by default and can be connected by directed, typed edges. The product helps people remember how ideas relate, rather than becoming a generic document editor or chatbot.

## MVP feature set

1. Email/password sign-up and sign-in using Supabase Auth.
2. Create, edit, pin, categorize, recolor, and delete private notes.
3. Search note title, body, and category.
4. Create directional links with six fixed relationship types.
5. Show outgoing links and backlinks.
6. Render a selectable knowledge graph.
7. Export notes and links to JSON.
8. Optional AI actions: explain, improve, summarize, generate. Results are drafts that require explicit user action.

## Architecture

- React UI calls Supabase Auth and PostgREST through supabase-js.
- PostgreSQL is the source of truth.
- RLS scopes each note and link to auth.uid().
- Composite foreign keys include owner ID and note ID, preventing links from crossing account boundaries.
- One Edge Function verifies the caller, checks a per-user daily request limit, validates payloads, routes to Gemini with a bounded Groq fallback, validates response completion, and returns a transient draft.
- The AI provider key stays in Edge Function secrets; it is never sent to the browser.

## Data model

- notes: id, user_id, title, content, category, color, is_pinned, created_at, updated_at.
- note_links: id, user_id, source_note_id, target_note_id, label, created_at.
- ai_usage: id, user_id, action, created_at. Server-only metadata; no note text.

## Milestones

### M0 — Foundation
- Vite + React + TypeScript scaffold.
- Supabase client and setup screen.
- Sign-up/sign-in and auth session lifecycle.
- SQL migration with schema constraints and ownership policies.
- Note editor, search, links, backlinks, graph and JSON export.
- AI Edge Function source with narrow request contract.
- Unit tests for filtering and relative time labels.

Acceptance: TypeScript, build, and unit tests pass locally; tables have RLS; account A cannot read or write account B's notes or links.

### M1 — Remote integration and security verification
- Configure .env.local using the project publishable key.
- Apply and verify migration; inspect RLS and grants.
- Test signup/signin/signout; confirm email redirect settings.
- Test create/edit/delete, reload persistence, links, backlinks, graph, and export.
- Run Supabase security and performance advisors.
- Configure GEMINI_API_KEY and GROQ_API_KEY in Edge Function secrets; test every AI action, incomplete output rejection, provider failover, missing keys, invalid sessions, oversized input, and quota behavior.

### M2 — UX quality
- Test autosave during rapid edits, tab switches, connection loss, and errors. Test AI drafts for completeness, specific titles, useful examples, provider failures, and readable user-facing errors.
- Verify keyboard navigation, focus management, labels, and small-screen layout.
- Review dense graph behavior and improve layout only if usage shows the circular layout is limiting.
- Add browser end-to-end tests for primary flows.

### M3 — Release
- Add GitHub Actions for typecheck, tests, and production build.
- Deploy the Vite app to a static frontend host.
- Configure production environment variables and Auth redirect URLs.
- Verify export and document recovery/backup expectations.
- Add clear AI privacy and daily quota disclosures in the app.

## Decisions and deferred scope

- Plain text/Markdown-friendly editor instead of rich text: fewer dependencies and predictable content.
- No custom Express/Spring API: Supabase covers routine authenticated CRUD.
- No automatic AI writes: user reviews and applies each draft.
- No collaboration, sharing, attachments, folders, vector database, RAG, agent framework, or persistent AI chat history in the MVP.
