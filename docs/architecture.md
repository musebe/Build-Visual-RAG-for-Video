# SceneSeeker architecture

## Demo proof

A reviewer can upload a video with no useful speech, search for a visible action or object, open a semantically matched scene, and verify that the Cloudinary Video Player seeks to the cited start time while the interface displays the source visual-transcript description.

## Why this architecture

Cloudinary's AI Video Analysis API generates the missing textual layer: timestamped descriptions of what is visible in each scene. The application embeds those descriptions, not the original video bytes. This makes visual scenes searchable with a conventional text embedding model while retaining the Cloudinary timestamps needed for citations.

The API is currently Beta and asynchronous. A request returns a `job_id`; a completed job returns a Cloudinary raw asset whose JSON contains `transcript`, `start_time`, and `end_time` for each segment. The job state must therefore survive longer than a single HTTP request.

## Trust zones

| Zone | Allowed responsibilities |
| --- | --- |
| Browser | Select a video, show upload and indexing status, submit search queries, render public delivery identifiers, and control the player |
| Next.js server | Validate files, sign Cloudinary operations, call AI Video Analysis with Basic authentication, fetch raw transcript output, generate embeddings, and call privileged Supabase operations |
| Cloudinary | Store the source video, run AI Video Analysis, store the generated raw transcript, optimize video delivery, and provide the player source |
| Supabase | Persist workflow state, scene timestamps and descriptions, vector embeddings, benchmark questions, expected scenes, and measured results |

No Cloudinary API secret, Supabase secret key, or OpenAI API key may enter a Client Component or browser response.

Video bytes travel directly from the browser to Cloudinary with short-lived signed parameters. The Next.js server chooses a random public ID and signs the accepted formats, ingestion context, tags, delivery type, and overwrite rule. After upload, the server reads the asset back by immutable `asset_id` and verifies its public-ID namespace, ingestion marker, decoded format, and actual byte size before analysis begins.

## Workflow state

```text
uploading
  -> uploaded
  -> analyzing
  -> transcript_ready
  -> embedding
  -> ready

Any state -> failed with a safe, actionable error
```

The UI polls a lightweight application status endpoint. That endpoint may poll Cloudinary for a pending analysis job, but it must make progress idempotently so repeated requests do not duplicate scene rows or embeddings.

## Data model

### `videos`

- UUID application ID
- immutable Cloudinary `asset_id`
- Cloudinary `public_id`
- title, format, duration, width, and height
- analysis `job_id` and status
- generated transcript asset ID, public ID, and URL
- analysis prompt and embedding model
- safe error code and timestamps

### `video_scenes`

- video ID and zero-based scene index
- exact `start_time` and `end_time` in seconds
- Cloudinary-generated visual description
- retrieval text used for embedding
- embedding vector and model
- uniqueness constraint on video ID plus scene index

### `benchmark_questions`

- video ID, question, expected scene index, and expected timestamp range
- retrieval rank, retrieved scene, retrieved timestamp, similarity, and pass flags
- benchmark version and run timestamp

## Semantic retrieval contract

Search embeds the question with the same model used for every stored scene, then calls a Supabase SQL function that filters by video ID before ranking with cosine distance. Each result returns:

- video ID and Cloudinary public ID
- scene ID and scene index
- visual-transcript description
- start and end times
- similarity score

Filtering inside the SQL function prevents an outer PostgREST filter from shrinking an already limited global result set.

The first demo uses exact cosine search because each video produces a modest number of scene rows. It does not add an approximate vector index prematurely. If the corpus grows toward hundreds of thousands of scenes, benchmark an HNSW index and its filtered-recall behavior before changing the retrieval proof.

`text-embedding-3-small` produces the 1,536-dimensional vectors in this version. Both the video row and each scene row persist that model name, and the SQL function filters on it. A query is rejected if the configured model differs from the indexed model because cross-model vector comparisons are not meaningful.

## Timestamp citations

A citation is correct only when it names the video and includes the exact Cloudinary segment range. Clicking it calls the Cloudinary player instance's `currentTime(start_time)` method and then starts playback. The visible result keeps the generated description and time range beside the player so a reviewer can verify the retrieval claim.

## Interface scope

The main page is a direct search tool, not an editorial landing page. It contains only:

1. One video upload or indexed-video selector.
2. One processing-state indicator.
3. One semantic search input.
4. One Cloudinary Video Player.
5. A concise ranked list of timestamped scene citations.

Architecture explanations, setup instructions, article metadata, and research notes stay in `docs/`. The 30-question evaluation lives on a separate `/benchmark` route so benchmark controls do not compete with the primary search task.

## Benchmark method

The proof asset contains 30 human-authored questions across the indexed silent-video set. Each question records an expected scene and acceptable timestamp range before retrieval runs.

Report these metrics separately:

1. **Top-1 scene accuracy:** the expected scene is ranked first.
2. **Top-3 scene recall:** the expected scene appears in the first three results.
3. **Timestamp overlap accuracy:** the top result's segment overlaps the labeled timestamp range.
4. **Start-time error:** absolute difference between the cited start time and labeled start time, in seconds.

The benchmark must preserve the question set, source videos, model name, transcript prompt, threshold, run date, and raw result rows. Do not claim accuracy until all 30 questions run against real Cloudinary transcripts and stored vectors.

The `/benchmark` workbench is deliberately separate from the search demo. A scene-catalog endpoint exposes descriptions and exact Cloudinary ranges for labeling, while the save endpoint requires exactly 30 non-placeholder questions and validates each expected scene and timestamp against the indexed source video. Benchmark retrieval uses an unthresholded top three so threshold tuning cannot silently improve the reported recall.

## Current constraints

- Cloudinary AI Video Analysis is Beta and may change before general availability.
- The generated descriptions can omit or misdescribe visual details, so retrieved citations need human-verifiable source playback.
- Text embeddings search the Cloudinary descriptions, not the video pixels directly.
- Scene boundaries are determined by Cloudinary's analysis output.
- The application needs a durable worker or resumable polling strategy for long videos in production.
- The first benchmark is an evaluation of one controlled dataset, not a universal measure of visual-video search quality.
