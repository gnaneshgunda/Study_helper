-- Semantic search function: returns top-k pages by cosine similarity
create or replace function match_pages (
  query_embedding  vector(768),
  document_id_filter uuid,
  match_count      int default 5
)
returns table (
  id          uuid,
  page_number int,
  text        text,
  similarity  float
)
language sql stable
as $$
  select
    id,
    page_number,
    text,
    1 - (embedding <=> query_embedding) as similarity
  from pages
  where document_id = document_id_filter
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
