create index if not exists benchmark_runs_video_id_idx
on public.benchmark_runs (video_id);

create index if not exists benchmark_results_question_id_idx
on public.benchmark_results (question_id);

revoke all privileges on table
  public.videos,
  public.video_scenes,
  public.benchmark_questions,
  public.benchmark_runs,
  public.benchmark_results
from anon, authenticated;

revoke all privileges on sequence
  public.video_scenes_id_seq,
  public.benchmark_questions_id_seq,
  public.benchmark_results_id_seq
from anon, authenticated;

grant select, insert, update, delete on table
  public.videos,
  public.video_scenes,
  public.benchmark_questions,
  public.benchmark_runs,
  public.benchmark_results
to service_role;

grant usage, select on sequence
  public.video_scenes_id_seq,
  public.benchmark_questions_id_seq,
  public.benchmark_results_id_seq
to service_role;

revoke execute on function public.set_updated_at()
from public, anon, authenticated;

grant execute on function public.set_updated_at()
to service_role;
