create table if not exists public.benchmark_questions (
  id bigint generated always as identity primary key,
  video_id uuid not null references public.videos(id) on delete cascade,
  benchmark_version text not null,
  position integer not null check (position between 1 and 30),
  question text not null,
  expected_scene_index integer not null check (expected_scene_index >= 0),
  expected_start_time double precision not null check (expected_start_time >= 0),
  expected_end_time double precision not null check (expected_end_time >= expected_start_time),
  created_at timestamptz not null default now(),
  unique (video_id, benchmark_version, position)
);

create table if not exists public.benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  benchmark_version text not null,
  embedding_model text not null,
  analysis_prompt text not null,
  match_count integer not null default 3,
  match_threshold double precision not null default -1,
  question_count integer not null,
  status text not null check (status in ('running', 'complete', 'failed')),
  top1_accuracy double precision,
  top3_recall double precision,
  timestamp_overlap_accuracy double precision,
  mean_start_time_error double precision,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.benchmark_results (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.benchmark_runs(id) on delete cascade,
  question_id bigint not null references public.benchmark_questions(id) on delete cascade,
  question text not null,
  expected_scene_index integer not null,
  expected_start_time double precision not null,
  expected_end_time double precision not null,
  retrieved_scene_index integer,
  retrieved_start_time double precision,
  retrieved_end_time double precision,
  similarity double precision,
  expected_rank integer,
  top1_correct boolean not null,
  top3_hit boolean not null,
  timestamp_overlap boolean not null,
  start_time_error double precision,
  created_at timestamptz not null default now(),
  unique (run_id, question_id)
);

alter table public.benchmark_questions enable row level security;
alter table public.benchmark_runs enable row level security;
alter table public.benchmark_results enable row level security;

comment on table public.benchmark_questions is
  'Human-labeled 30-question visual retrieval benchmark sets.';
comment on table public.benchmark_runs is
  'Reproducible benchmark configuration and aggregate metrics.';
comment on table public.benchmark_results is
  'Per-question scene ranking and timestamp correctness evidence.';

