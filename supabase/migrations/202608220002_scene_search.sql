create or replace function public.match_video_scenes(
  query_video_id uuid,
  query_embedding extensions.vector(1536),
  query_model text,
  match_threshold double precision default 0.2,
  match_count integer default 5
)
returns table (
  video_id uuid,
  cloudinary_public_id text,
  scene_id bigint,
  scene_index integer,
  description text,
  start_time double precision,
  end_time double precision,
  similarity double precision
)
language sql
stable
set search_path = ''
as $$
  select
    scenes.video_id,
    videos.cloudinary_public_id,
    scenes.id as scene_id,
    scenes.scene_index,
    scenes.description,
    scenes.start_time,
    scenes.end_time,
    1 - (scenes.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.video_scenes as scenes
  inner join public.videos as videos on videos.id = scenes.video_id
  where scenes.video_id = query_video_id
    and videos.status = 'ready'
    and scenes.embedding is not null
    and scenes.embedding_model = query_model
    and 1 - (scenes.embedding operator(extensions.<=>) query_embedding) >= match_threshold
  order by scenes.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.match_video_scenes(
  uuid,
  extensions.vector,
  text,
  double precision,
  integer
) from public, anon, authenticated;

grant execute on function public.match_video_scenes(
  uuid,
  extensions.vector,
  text,
  double precision,
  integer
) to service_role;

comment on function public.match_video_scenes is
  'Ranks one ready video''s scene descriptions by cosine similarity after filtering by video and model.';
