# StudyDeck

A slides-first study app. Upload course PDFs, ask AI doubts about the slide you're on, save answers as notes pinned to that slide, and study your own annotated material.

## Features (MVP)

- **Sign in** with email or Google (Supabase Auth)
- **Courses → Lectures → Documents** hierarchy
- **PDF viewer** with zoom and keyboard navigation (← →)
- **Doubt chat** — AI sees the current slide text and answers in context, streamed token-by-token
- **Save to note** — one click turns any AI answer into a note pinned to that slide
- **Notes editor** — Markdown with live KaTeX preview, edit/split/preview modes, debounced autosave
- **Format with AI** — cleans up rough notes and converts math shorthand to KaTeX; shows a diff preview before applying
- **Summarise doubt** — converts a whole chat thread into a structured study note

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS |
| PDF rendering | react-pdf (PDF.js) |
| Math | KaTeX (`$...$` inline, `$$...$$` block) |
| Backend & data | Supabase (Postgres, Auth, Storage, pgvector) |
| AI — chat & format | Groq (`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`) |
| AI — vision & embed | Gemini (`gemini-3.8-flash` / `text-embedding-004`) |
| Hosting | Vercel + Supabase |

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/gnaneshgunda/Study_helper.git
cd Study_helper/studydeck
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a project, then run both migrations:

```bash
# using the Supabase CLI
supabase db push --file supabase/migrations/001_initial_schema.sql
supabase db push --file supabase/migrations/002_storage.sql
```

Or paste them directly in the Supabase SQL editor.

Enable **Google OAuth** in Authentication → Providers if you want social login.

### 3. Get API keys (all free tier)

- **Supabase**: Project Settings → API → `URL`, `anon key`, `service_role key`
- **Groq**: [console.groq.com](https://console.groq.com) → API Keys (no credit card)
- **Gemini**: [aistudio.google.com](https://aistudio.google.com) → Get API key (free tier)

### 4. Set environment variables

```bash
cp .env.local.example .env.local   # or create it manually
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> AI keys are server-side only — never prefixed with `NEXT_PUBLIC_`.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
├── app/
│   ├── api/ai/          # chat (SSE), format-note, doubt-to-note, flashcards, revision-sheet
│   ├── api/upload/      # PDF upload + pdfjs text extraction
│   ├── auth/            # login page, OAuth callback
│   └── courses/         # courses list, course detail, document viewer
├── components/
│   ├── auth/            # LoginForm
│   ├── chat/            # ChatPanel, SidePanel
│   ├── courses/         # CoursesClient, CourseDetailClient, UploadModal
│   ├── notes/           # NotesPanel, NoteEditor, NoteCard
│   ├── pdf/             # SlideViewer, ViewerShell
│   └── ui/              # AppShell, MarkdownRenderer
├── lib/
│   ├── ai/              # complete.ts, config.ts, prompts.ts, providers/
│   └── supabase/        # client.ts, server.ts, middleware.ts
└── types/
    └── database.ts      # Full type definitions for all tables
supabase/migrations/     # SQL — run these once in your project
```

## Roadmap

- **V2**: highlight colours (important / confused / exam), doubt status (open/resolved), spaced-repetition flashcards, search
- **V3**: formula snip → LaTeX, quiz generation, export annotated PDF, sharing

## License

MIT
