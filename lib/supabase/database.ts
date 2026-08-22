export type VideoStatus =
  | "uploaded"
  | "analyzing"
  | "transcript_ready"
  | "embedding"
  | "ready"
  | "failed";

export type VideoRowData = {
  id: string;
  cloudinary_asset_id: string;
  cloudinary_public_id: string;
  original_filename: string;
  secure_url: string;
  format: string;
  bytes: number;
  duration: number;
  width: number;
  height: number;
  status: VideoStatus;
  analysis_job_id: string | null;
  analysis_prompt: string;
  transcript_asset_id: string | null;
  transcript_public_id: string | null;
  transcript_url: string | null;
  embedding_model: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

type VideoInsert = Omit<
  VideoRowData,
  | "id"
  | "status"
  | "analysis_job_id"
  | "transcript_asset_id"
  | "transcript_public_id"
  | "transcript_url"
  | "embedding_model"
  | "error_code"
  | "created_at"
  | "updated_at"
> &
  Partial<
    Pick<
      VideoRowData,
      | "id"
      | "status"
      | "analysis_job_id"
      | "transcript_asset_id"
      | "transcript_public_id"
      | "transcript_url"
      | "embedding_model"
      | "error_code"
      | "created_at"
      | "updated_at"
    >
  >;

type VideoUpdate = Partial<VideoInsert>;

export type SceneRowData = {
  id: number;
  video_id: string;
  scene_index: number;
  start_time: number;
  end_time: number;
  description: string;
  retrieval_text: string;
  embedding: number[] | null;
  embedding_model: string | null;
  created_at: string;
  updated_at: string;
};

type SceneInsert = Omit<
  SceneRowData,
  "id" | "embedding" | "embedding_model" | "created_at" | "updated_at"
> &
  Partial<
    Pick<
      SceneRowData,
      "id" | "embedding" | "embedding_model" | "created_at" | "updated_at"
    >
  >;

type SceneUpdate = Partial<SceneInsert>;

type BenchmarkQuestionRow = {
  id: number;
  video_id: string;
  benchmark_version: string;
  position: number;
  question: string;
  expected_scene_index: number;
  expected_start_time: number;
  expected_end_time: number;
  created_at: string;
};

type BenchmarkRunRow = {
  id: string;
  video_id: string;
  benchmark_version: string;
  embedding_model: string;
  analysis_prompt: string;
  match_count: number;
  match_threshold: number;
  question_count: number;
  status: "running" | "complete" | "failed";
  top1_accuracy: number | null;
  top3_recall: number | null;
  timestamp_overlap_accuracy: number | null;
  mean_start_time_error: number | null;
  created_at: string;
  completed_at: string | null;
};

type BenchmarkResultRow = {
  id: number;
  run_id: string;
  question_id: number;
  question: string;
  expected_scene_index: number;
  expected_start_time: number;
  expected_end_time: number;
  retrieved_scene_index: number | null;
  retrieved_start_time: number | null;
  retrieved_end_time: number | null;
  similarity: number | null;
  expected_rank: number | null;
  top1_correct: boolean;
  top3_hit: boolean;
  timestamp_overlap: boolean;
  start_time_error: number | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      videos: {
        Row: VideoRowData;
        Insert: VideoInsert;
        Update: VideoUpdate;
        Relationships: [];
      };
      video_scenes: {
        Row: SceneRowData;
        Insert: SceneInsert;
        Update: SceneUpdate;
        Relationships: [
          {
            foreignKeyName: "video_scenes_video_id_fkey";
            columns: ["video_id"];
            isOneToOne: false;
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
        ];
      };
      benchmark_questions: {
        Row: BenchmarkQuestionRow;
        Insert: Omit<BenchmarkQuestionRow, "id" | "created_at"> &
          Partial<Pick<BenchmarkQuestionRow, "id" | "created_at">>;
        Update: Partial<Omit<BenchmarkQuestionRow, "id">>;
        Relationships: [];
      };
      benchmark_runs: {
        Row: BenchmarkRunRow;
        Insert: Omit<
          BenchmarkRunRow,
          | "id"
          | "top1_accuracy"
          | "top3_recall"
          | "timestamp_overlap_accuracy"
          | "mean_start_time_error"
          | "created_at"
          | "completed_at"
        > &
          Partial<
            Pick<
              BenchmarkRunRow,
              | "id"
              | "top1_accuracy"
              | "top3_recall"
              | "timestamp_overlap_accuracy"
              | "mean_start_time_error"
              | "created_at"
              | "completed_at"
            >
          >;
        Update: Partial<Omit<BenchmarkRunRow, "id">>;
        Relationships: [];
      };
      benchmark_results: {
        Row: BenchmarkResultRow;
        Insert: Omit<BenchmarkResultRow, "id" | "created_at"> &
          Partial<Pick<BenchmarkResultRow, "id" | "created_at">>;
        Update: Partial<Omit<BenchmarkResultRow, "id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_video_scenes: {
        Args: {
          query_video_id: string;
          query_embedding: number[];
          query_model: string;
          match_threshold: number;
          match_count: number;
        };
        Returns: {
          video_id: string;
          cloudinary_public_id: string;
          scene_id: number;
          scene_index: number;
          description: string;
          start_time: number;
          end_time: number;
          similarity: number;
        }[];
      };
    };
  };
};
