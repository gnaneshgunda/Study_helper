-- Enable pgvector extension for embeddings
create extension if not exists vector;

-- ─── courses ────────────────────────────────────────────────────────────────
create table courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  code        text,
  semester    text,
  color       text not null default '#4f6bed',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table courses enable row level security;

create policy "courses: users own their data"
  on courses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── lectures ───────────────────────────────────────────────────────────────
create table lectures (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses(id) on delete cascade,
  title       text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table lectures enable row level security;

create policy "lectures: users own their data"
  on lectures for all
  using (
    exists (
      select 1 from courses c
      where c.id = lectures.course_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from courses c
      where c.id = lectures.course_id and c.user_id = auth.uid()
    )
  );

-- ─── documents ──────────────────────────────────────────────────────────────
create table documents (
  id            uuid primary key default gen_random_uuid(),
  lecture_id    uuid not null references lectures(id) on delete cascade,
  storage_path  text not null,
  title         text not null,
  page_count    integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table documents enable row level security;

create policy "documents: users own their data"
  on documents for all
  using (
    exists (
      select 1 from lectures l
        join courses c on c.id = l.course_id
      where l.id = documents.lecture_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from lectures l
        join courses c on c.id = l.course_id
      where l.id = documents.lecture_id and c.user_id = auth.uid()
    )
  );

-- ─── pages ──────────────────────────────────────────────────────────────────
create table pages (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  page_number  integer not null,
  text         text not null default '',
  embedding    vector(768),
  unique (document_id, page_number)
);

alter table pages enable row level security;

create policy "pages: users own their data"
  on pages for all
  using (
    exists (
      select 1 from documents d
        join lectures l on l.id = d.lecture_id
        join courses c on c.id = l.course_id
      where d.id = pages.document_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from documents d
        join lectures l on l.id = d.lecture_id
        join courses c on c.id = l.course_id
      where d.id = pages.document_id and c.user_id = auth.uid()
    )
  );

-- ─── notes ──────────────────────────────────────────────────────────────────
create table notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  course_id    uuid not null references courses(id) on delete cascade,
  document_id  uuid not null references documents(id) on delete cascade,
  page_number  integer not null,
  anchor       jsonb,              -- {x: float, y: float} as fraction of page
  content_md   text not null default '',
  source       text not null default 'manual' check (source in ('manual','ai','doubt')),
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table notes enable row level security;

create policy "notes: users own their data"
  on notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── highlights ─────────────────────────────────────────────────────────────
create table highlights (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  page_number  integer not null,
  rects        jsonb not null default '[]',
  color        text not null default '#fde047',
  kind         text not null default 'important' check (kind in ('important','confused','exam')),
  created_at   timestamptz not null default now()
);

alter table highlights enable row level security;

create policy "highlights: users own their data"
  on highlights for all
  using (
    exists (
      select 1 from documents d
        join lectures l on l.id = d.lecture_id
        join courses c on c.id = l.course_id
      where d.id = highlights.document_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from documents d
        join lectures l on l.id = d.lecture_id
        join courses c on c.id = l.course_id
      where d.id = highlights.document_id and c.user_id = auth.uid()
    )
  );

-- ─── doubts ─────────────────────────────────────────────────────────────────
create table doubts (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  page_number  integer not null,
  anchor       jsonb,
  title        text not null,
  status       text not null default 'open' check (status in ('open','resolved')),
  created_at   timestamptz not null default now()
);

alter table doubts enable row level security;

create policy "doubts: users own their data"
  on doubts for all
  using (
    exists (
      select 1 from documents d
        join lectures l on l.id = d.lecture_id
        join courses c on c.id = l.course_id
      where d.id = doubts.document_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from documents d
        join lectures l on l.id = d.lecture_id
        join courses c on c.id = l.course_id
      where d.id = doubts.document_id and c.user_id = auth.uid()
    )
  );

-- ─── messages ───────────────────────────────────────────────────────────────
create table messages (
  id         uuid primary key default gen_random_uuid(),
  doubt_id   uuid not null references doubts(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

create policy "messages: users own their data"
  on messages for all
  using (
    exists (
      select 1 from doubts dbt
        join documents d on d.id = dbt.document_id
        join lectures l on l.id = d.lecture_id
        join courses c on c.id = l.course_id
      where dbt.id = messages.doubt_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from doubts dbt
        join documents d on d.id = dbt.document_id
        join lectures l on l.id = d.lecture_id
        join courses c on c.id = l.course_id
      where dbt.id = messages.doubt_id and c.user_id = auth.uid()
    )
  );

-- ─── flashcards ─────────────────────────────────────────────────────────────
create table flashcards (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses(id) on delete cascade,
  note_id       uuid references notes(id) on delete set null,
  front         text not null,
  back          text not null,
  ease          real not null default 2.5,
  interval_days integer not null default 1,
  due_at        timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

alter table flashcards enable row level security;

create policy "flashcards: users own their data"
  on flashcards for all
  using (
    exists (
      select 1 from courses c
      where c.id = flashcards.course_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from courses c
      where c.id = flashcards.course_id and c.user_id = auth.uid()
    )
  );

-- ─── ai_cache ───────────────────────────────────────────────────────────────
create table ai_cache (
  id          uuid primary key default gen_random_uuid(),
  input_hash  text not null unique,
  task        text not null,
  result      text not null,
  created_at  timestamptz not null default now()
);

-- Cache is not user-specific; service role only
alter table ai_cache enable row level security;
create policy "ai_cache: service role only"
  on ai_cache for all
  using (false);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index on pages using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on notes (user_id, course_id);
create index on doubts (document_id, page_number);
create index on messages (doubt_id, created_at);

-- ─── updated_at trigger ──────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger courses_updated_at before update on courses
  for each row execute function update_updated_at();

create trigger notes_updated_at before update on notes
  for each row execute function update_updated_at();
