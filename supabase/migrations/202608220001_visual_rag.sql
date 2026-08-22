create extension if not exists vector with schema extensions;

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  cloudinary_asset_id text not null unique,
  cloudinary_public_id text not null unique,
  original_filename text not null,
  secure_url text not null,
  format text not null,
  bytes bigint not null check (bytes >= 0),
  duration double precision not null check (duration >= 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  status text not null default 'uploaded' check (
    status in ('uploaded', 'analyzing', 'transcript_ready', 'embedding', 'ready', 'failed')
  ),
  analysis_job_id text,
  analysis_prompt text not null,
  transcript_asset_id text,
  transcript_public_id text,
  transcript_url text,
  embedding_model text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.video_scenes (
  id bigint generated always as identity primary key,
  video_id uuid not null references public.videos(id) on delete cascade,
  scene_index integer not null check (scene_index >= 0),
  start_time double precision not null check (start_time >= 0),
  end_time double precision not null check (end_time >= start_time),
  description text not null,
  retrieval_text text not null,
  embedding extensions.vector(1536),
  embedding_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_id, scene_index)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists videos_set_updated_at on public.videos;
create trigger videos_set_updated_at
before update on public.videos
for each row execute function public.set_updated_at();

drop trigger if exists video_scenes_set_updated_at on public.video_scenes;
create trigger video_scenes_set_updated_at
before update on public.video_scenes
for each row execute function public.set_updated_at();

alter table public.videos enable row level security;
alter table public.video_scenes enable row level security;

comment on table public.videos is
  'Server-managed Cloudinary video ingestion and analysis workflow state.';

comment on table public.video_scenes is
  'Timestamped Cloudinary visual-transcript scenes and their retrieval vectors.';

