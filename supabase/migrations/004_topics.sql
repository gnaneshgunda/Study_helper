-- Add topic column to notes for topic-wise organization
alter table notes add column if not exists topic text;

-- Index for fast topic filtering
create index if not exists notes_topic_idx on notes (course_id, topic);

-- Function to find similar doubts by keyword similarity
-- (used by doubt memory feature — shows "you asked something similar before")
create or replace function find_similar_doubts (
  search_text text,
  course_filter uuid,
  match_count int default 3
)
returns table (
  id uuid,
  title text,
  status text,
  page_number int,
  document_id uuid,
  similarity float
)
language sql stable
as $$
  select
    d.id,
    d.title,
    d.status,
    d.page_number,
    d.document_id,
    -- Simple word-overlap similarity (no embedding needed)
    ts_rank(
      to_tsvector('english', d.title),
      plainto_tsquery('english', search_text)
    ) as similarity
  from doubts d
  join documents doc on doc.id = d.document_id
  join lectures l on l.id = doc.lecture_id
  where l.course_id = course_filter
    and to_tsvector('english', d.title) @@ plainto_tsquery('english', search_text)
  order by similarity desc
  limit match_count;
$$;
