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
