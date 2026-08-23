# Build Visual RAG for Video: Search Silent Scenes and Cite Exact Timestamps With Cloudinary

AI can search a video with no speech by converting each visual scene into timestamped text, embedding those scene descriptions, and retrieving the closest scene for a natural-language question. The answer can then cite the scene's exact start and end times and seek the video player directly to that evidence.

In this tutorial, you will build that retrieval pipeline with Next.js, Cloudinary AI Video Analysis, Gemini embeddings, Supabase `pgvector`, and the Cloudinary Video Player.

- [Try the live SceneSeeker demo](https://build-visual-rag-for-video.vercel.app/)
- [Explore the complete GitHub repository](https://github.com/musebe/Build-Visual-RAG-for-Video)

The finished application is the retrieval layer of Visual Retrieval-Augmented Generation (RAG). It returns ranked, timestamped evidence rather than asking a language model to invent an answer. You can add generation later, using only the retrieved scenes as grounded context.

## What you will build

The application follows this pipeline:

```text
Browser
  -> signed direct video upload to Cloudinary
  -> Cloudinary Admin API verification
  -> Cloudinary AI Video Analysis job
  -> timestamped visual-transcript JSON
  -> one Gemini embedding per visual scene
  -> Supabase pgvector scene index
  -> semantic query retrieval
  -> timestamp citation in Cloudinary Video Player
```

A visitor can load the included sea-turtle demo or upload an MP4, MOV, or WebM file. Cloudinary describes visually distinct scenes and assigns timestamps. The application embeds those descriptions, stores them in Postgres, and returns results such as `0:04.5–0:08.5`. Selecting a result seeks the player to that moment.

The demo also includes a reproducible 30-question benchmark. That proof matters because an attractive search interface does not tell you whether the expected scene was retrieved.

## Why speech transcripts cannot search silent video

Speech transcription answers questions about what was said. It cannot reliably answer questions such as:

- When does the turtle swim toward the camera?
- Which moment shows the subject from below?
- When does an object leave the frame?
- Where does visible text or a color change appear?

Those answers exist in pixels, not audio.

[Cloudinary AI Video Analysis](https://cloudinary.com/documentation/ai_video_analysis) generates a visual transcript for a video already stored in your Cloudinary product environment. Each segment contains a description plus `start_time` and `end_time`. The feature is currently Beta, so confirm access in the product environment you will use and recheck the current API contract before production deployment.

This gives the retrieval system two things that a normal speech transcript cannot provide: semantic descriptions of visible events and source-aligned time ranges.

## Understand the Visual RAG architecture

The original [RAG paper](https://arxiv.org/abs/2005.11401) combines retrieval with generation so a model can answer from external evidence. In a visual-video workflow, the evidence must first be made searchable.

This project separates that process into four stages:

| Stage | Responsibility | Source of truth |
| --- | --- | --- |
| Ingest | Store and verify the video | Cloudinary asset ID |
| Understand | Describe scenes and preserve their times | Cloudinary visual transcript |
| Retrieve | Embed and rank matching scenes | Supabase `pgvector` |
| Cite | Seek to the retrieved source range | Cloudinary Video Player |

The architecture deliberately keeps timestamps attached to descriptions throughout the pipeline. If text is embedded without its source range, search may find a relevant description but cannot produce a verifiable video citation.

## Prerequisites

You need:

- Node.js 20 or later.
- A Cloudinary account and product environment with AI Video Analysis Beta access.
- A Supabase project.
- A Gemini API key from [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key).
- A Vercel account only if you want to deploy the application.

The project uses Next.js 16, React 19, TypeScript, `next-cloudinary`, the Cloudinary Node.js SDK, shadcn components, and Vitest. It was scaffolded from [create-cloudinary-next](https://github.com/cloudinary-devs/create-cloudinary-next).

Clone the finished project and install its dependencies:

```bash
git clone https://github.com/musebe/Build-Visual-RAG-for-Video.git
cd Build-Visual-RAG-for-Video
npm install
```

## Step 1: Configure Cloudinary

Cloudinary is responsible for the original video, the visual analysis job, the generated transcript asset, and playback.

In the Cloudinary Console:

1. Create or select a product environment.
2. Open **Settings**, then **API Keys**.
3. Copy the cloud name, API key, and API secret.
4. Confirm that this product environment has access to the **AI Video Analysis API (Beta)**.
5. Upload a demo video to the Media Library if you want a reusable one-click example.
6. Open that asset and copy its immutable asset ID for `DEMO_VIDEO_ASSET_ID`.

AI Video Analysis is an API capability, not one of the similarly named Marketplace tagging or transcription add-ons. Access and commercial terms can change while the API is in Beta.

Create `.env.local` from the template:

```bash
cp .env.example .env.local
```

Add placeholders for your own credentials:

```dotenv
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_server_secret_key

GEMINI_API_KEY=your_gemini_api_key
GEMINI_EMBEDDING_MODEL=gemini-embedding-2

DEMO_VIDEO_ASSET_ID=your_cloudinary_video_asset_id
MAX_VIDEO_BYTES=104857600
```

Only the Cloudinary cloud name is public. Keep the Cloudinary API secret, Supabase secret key, and Gemini API key in server-only variables. Rotate a secret immediately if it appears in a screenshot, chat, log, or Git commit.

The 100 MB value is this demo's application limit, not a statement about Cloudinary's platform limit. Adjust it for your threat model and deployment environment.

## Step 2: Create the Supabase vector schema

Apply all files in [`supabase/migrations`](https://github.com/musebe/Build-Visual-RAG-for-Video/tree/main/supabase/migrations) in filename order with the Supabase CLI or SQL Editor.

The first migration enables `pgvector`, creates the workflow tables, and stores each scene with its original time range:

```sql
create extension if not exists vector with schema extensions;

create table public.video_scenes (
  id bigint generated always as identity primary key,
  video_id uuid not null references public.videos(id) on delete cascade,
  scene_index integer not null,
  start_time double precision not null,
  end_time double precision not null check (end_time >= start_time),
  description text not null,
  embedding extensions.vector(1536),
  embedding_model text,
  unique (video_id, scene_index)
);
```

The complete [`visual RAG schema`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/supabase/migrations/202608220001_visual_rag.sql) also records Cloudinary asset identifiers, analysis jobs, transcript assets, processing states, and timestamps. Later migrations add search, benchmark storage, indexes, and server-only permissions.

Row-level security is enabled without browser policies because the application accesses these tables only through trusted Next.js routes. The Supabase secret key never reaches the client.

## Step 3: Upload videos directly to Cloudinary

Large video bytes should not pass through the Next.js server just to reach Cloudinary. Instead, the browser requests constrained signed parameters from the server and uploads directly to Cloudinary.

The signing engine fixes the public ID, accepted formats, tags, context, overwrite behavior, and timestamp before generating a signature:

```typescript
const signedParams = {
  allowed_formats: ["mp4", "mov", "webm"],
  context: `ingest_id=${ingestId}`,
  overwrite: false,
  public_id: `visual-rag/videos/${ingestId}`,
  tags: "visual-rag,silent-video-search",
  timestamp: Math.floor(Date.now() / 1000),
  type: "upload" as const,
};

const signature = cloudinary.utils.api_sign_request(
  signedParams,
  process.env.CLOUDINARY_API_SECRET!,
);
```

See the complete [`signed-upload implementation`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/lib/cloudinary/video-assets.ts) and [`signature route`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/app/api/uploads/sign/route.ts). Cloudinary's [upload-signature guide](https://cloudinary.com/documentation/authentication_signatures) explains why the signature must be created in a trusted environment.

The browser validates the declared MIME type, byte size, and file header before requesting a signature. It then uses `XMLHttpRequest` so the UI can report upload progress. Read the full [`browser upload client`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/lib/client/cloudinary-upload.ts).

Client checks improve feedback, but they are not a security boundary. After upload, the server reads the asset through the Cloudinary Admin API and verifies its immutable `asset_id`, generated public-ID namespace, ingestion context, decoded format, and actual byte size.

## Step 4: Reuse one Cloudinary demo video

The live application offers a **Load demo video** button so a reader can test search without uploading duplicate content. `POST /api/videos/demo` reads `DEMO_VIDEO_ASSET_ID`, checks whether it was already indexed, and reuses the existing database record.

If it is new, the route reads the Cloudinary asset by ID and starts the same analysis pipeline used for uploads:

```typescript
const existing = await findVideoByAssetId(assetId);
if (existing) return NextResponse.json({ video: toPublicVideo(existing) });

const asset = await getVideoByAssetId(assetId);
assertVideoConstraints(asset);
const video = await createVideo({
  video: asset,
  originalFilename: filename,
  analysisPrompt: DEFAULT_VISUAL_TRANSCRIPTION_PROMPT,
});
```

See the complete [`demo-video route`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/app/api/videos/demo/route.ts). Using the immutable asset ID avoids relying on a changeable filename or public ID as the application's identity key.

## Step 5: Run Cloudinary AI Video Analysis

The analysis endpoint accepts a Cloudinary video asset ID and an optional visual-transcription prompt. The project asks for concrete, visible evidence and tells the service not to infer speech:

```typescript
export const DEFAULT_VISUAL_TRANSCRIPTION_PROMPT =
  "Describe each visually distinct scene with concrete actions, people, " +
  "objects, settings, visible text, and changes. Do not infer speech or " +
  "events that are not visible.";

await fetch(analysisUrl, {
  method: "POST",
  headers: { Authorization: basicAuthorization },
  body: JSON.stringify({
    video_asset_id: videoAssetId,
    visual_transcription_prompt: prompt,
  }),
});
```

The full [`AI Video Analysis client`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/lib/cloudinary/ai-video-analysis.ts) sends credentials in the server-side authorization header, applies a timeout, validates the response, and avoids logging credentials.

Analysis is asynchronous. The initial request returns a `job_id`, which the application persists before polling. A status request can return `pending`, `completed`, or `failed`. Persisting the job ID means the process can continue across requests instead of keeping one HTTP connection open.

## Step 6: Read and validate the visual transcript

When the job completes, Cloudinary returns a raw visual-transcript asset. The application accepts only HTTPS URLs on `res.cloudinary.com`, bounds the download size, and validates every segment with Zod:

```typescript
const sceneSchema = z.object({
  transcript: z.string().trim().min(1).max(5_000),
  start_time: z.coerce.number().finite().nonnegative(),
  end_time: z.coerce.number().finite().nonnegative(),
}).refine((scene) => scene.end_time >= scene.start_time);

const transcriptSchema = z.array(sceneSchema).min(1).max(10_000);
```

See [`visual-transcript.ts`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/lib/cloudinary/visual-transcript.ts) for the response-envelope and transcript parsers.

For the 15.215-second sea-turtle demo, Cloudinary generated three scenes:

| Scene | Start | End | Visual evidence |
| --- | ---: | ---: | --- |
| 0 | 0:00 | 0:04 | Turtle viewed from a low angle while turning through blue water |
| 1 | 0:04.5 | 0:08.5 | Turtle swims toward and past the camera for a close view |
| 2 | 0:08.5 | 0:12.5 | Turtle swims away and becomes more distant |

One Cloudinary segment becomes one retrievable scene. This keeps the generated description, scene index, and source timestamps together. More elaborate chunking can merge or split scenes, but it must preserve the mapping back to the original time ranges.

## Step 7: Generate retrieval embeddings with Gemini

The project uses `gemini-embedding-2` and explicitly requests 1,536 output dimensions to match the Postgres vector column.

Google's current [Gemini embeddings documentation](https://ai.google.dev/gemini-api/docs/embeddings) recommends distinguishing retrieval documents from retrieval queries in the input. The project prepares them like this:

```typescript
export function prepareSearchDocument(text: string) {
  return `title: video scene | text: ${normalizeEmbeddingInput(text)}`;
}

export function prepareSearchQuery(query: string) {
  return `task: search result | query: ${normalizeEmbeddingInput(query)}`;
}
```

The embedding client bounds each input, requests the expected dimensions, validates every returned number, and processes scenes with limited concurrency. See [`gemini.ts`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/lib/embeddings/gemini.ts) and [`retrieval-input.ts`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/lib/embeddings/retrieval-input.ts).

Documents and queries must use the same embedding model and dimension. Changing models requires re-embedding the scene corpus. The application stores the model name beside each vector and rejects search when the indexed model differs from the configured model.

## Step 8: Store scene embeddings in pgvector

Once the transcript is ready, `POST /api/videos/:videoId/index` claims the video for indexing, embeds every scene description, upserts the vectors, and advances the workflow to `ready`.

```typescript
const scenes = await getScenesForEmbedding(video.id);
const embeddings = await embedDocuments(
  scenes.map((scene) => scene.retrieval_text),
);

await persistSceneEmbeddings({
  video,
  scenes,
  embeddings,
  model: env.GEMINI_EMBEDDING_MODEL,
});
```

Read the complete [`index route`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/app/api/videos/%5BvideoId%5D/index/route.ts) and [`repository`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/lib/videos/repository.ts).

The workflow states `uploaded`, `analyzing`, `transcript_ready`, `embedding`, `ready`, and `failed` make partial processing visible. Conditional updates also stop two requests from claiming the same indexing step.

For production workloads, move long analysis and embedding stages into a durable background workflow with retries, idempotency, and observability. A browser polling loop is suitable for this focused demo, not for high-volume ingestion.

## Step 9: Build video-scoped semantic search

Supabase ranks vectors with cosine distance. The SQL function first restricts the search to the requested ready video and matching embedding model, then orders those scenes by similarity:

```sql
select
  scenes.scene_index,
  scenes.description,
  scenes.start_time,
  scenes.end_time,
  1 - (scenes.embedding operator(extensions.<=>) query_embedding) as similarity
from public.video_scenes as scenes
join public.videos as videos on videos.id = scenes.video_id
where scenes.video_id = query_video_id
  and videos.status = 'ready'
  and scenes.embedding_model = query_model
order by scenes.embedding operator(extensions.<=>) query_embedding
limit least(greatest(match_count, 1), 20);
```

Read the complete [`scene-search migration`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/supabase/migrations/202608220002_scene_search.sql). Pushing the video filter into the database function follows [Supabase's semantic-search guidance](https://supabase.com/docs/guides/ai/semantic-search) and avoids retrieving unrelated rows before filtering them in application code.

The demo uses exact cosine search because each indexed video has a modest number of scenes. As the corpus grows, evaluate a vector index such as HNSW and measure recall with your real filters. Supabase documents the available tradeoffs in its [vector-index guide](https://supabase.com/docs/guides/ai/vector-indexes).

## Step 10: Return timestamped citations

`POST /api/videos/:videoId/search` validates the question, embeds it as a retrieval query, calls the Supabase function, and converts each database match into a public citation:

```typescript
const embedding = await embedQuery(input.query);
const matches = await searchVideoScenes({
  videoId,
  embedding,
  model,
  threshold: input.threshold,
  limit: input.limit,
});

return matches.map((match, index) =>
  toTimestampCitation(match, index + 1),
);
```

The response includes the scene description, similarity, start time, end time, and display citation. See the complete [`search route`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/app/api/videos/%5BvideoId%5D/search/route.ts) and [`citation formatter`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/lib/search/contracts.ts).

A language model is not required to produce this result. If you add one, give it only the retrieved descriptions and timestamps, require citations, and keep the source scene results visible. Retrieval quality and answer quality should be evaluated separately.

## Step 11: Connect citations to Cloudinary Video Player

The UI renders `CldVideoPlayer` from `next-cloudinary`. Because the player depends on browser APIs, it is dynamically imported with server-side rendering disabled. When a visitor selects a result, the component seeks to the cited start time and begins playback:

```typescript
function playCitation(result: SearchResult) {
  playerRef.current?.currentTime(result.startTime);
  playerRef.current?.play();
}
```

Cloudinary's [Video Player API](https://cloudinary.com/documentation/video_player_api_reference) exposes `currentTime()` and `play()` for this interaction. The complete [`video-search component`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/components/video-search-demo.tsx) also includes upload progress, processing states, accessible result buttons, and three example searches that readers can paste with one click.

Try these questions in the live demo:

- When is the turtle viewed from below?
- When does the turtle swim close to the camera?
- When does the turtle swim away?

## Step 12: Build the 30-question benchmark

The benchmark tests two distinct claims:

1. Did retrieval rank the human-labeled scene first?
2. Did the top citation overlap the human-labeled time range?

The [`sea-turtle-v1` dataset](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/benchmarks/sea-turtle-v1.json) contains exactly 30 questions, with ten labels for each of the three scenes. Labels were created by watching the source video before retrieval, not by copying wording from Cloudinary's generated descriptions.

Each run stores its dataset version, Cloudinary analysis prompt, embedding model, threshold, result count, ranked results, and aggregate metrics. This makes the result reproducible and prevents a tuned threshold from silently hiding difficult matches.

The benchmark reports:

| Metric | Definition |
| --- | --- |
| Top-1 scene accuracy | Percentage of questions whose labeled scene ranks first |
| Top-3 scene recall | Percentage whose labeled scene appears in the first three |
| Timestamp overlap | Percentage whose top result overlaps the labeled time interval |
| Mean start-time error | Mean absolute difference between retrieved and labeled start times |

You can inspect the browser workbench at `/benchmark?video=<video-id>` and the full [`benchmark protocol`](https://github.com/musebe/Build-Visual-RAG-for-Video/blob/main/docs/benchmark.md).

## Benchmark results

The verified run completed on August 23, 2026 against Cloudinary's 15.215-second `samples/sea-turtle` video. It used three Cloudinary scenes, `gemini-embedding-2` at 1,536 dimensions, cosine similarity, no tuned retrieval threshold, and three returned results.

| Metric | Result |
| --- | ---: |
| Top-1 scene accuracy | 86.67% (26/30) |
| Top-3 scene recall | 100% (30/30) |
| Top-result timestamp overlap | 86.67% (26/30) |
| Mean absolute start-time error | 0.73 seconds |

Four questions labeled for the opening scene ranked a later scene first. The misses used phrases such as “turn,” “before it approaches,” and “angled across the frame,” which also describe movement in later scenes. In all four cases, the expected scene ranked third.

This is a controlled demo result, not a general accuracy claim. Because the corpus contains one short video and exactly three indexed scenes, returning three results makes top-3 recall a weak metric. A stronger evaluation needs longer silent videos, more scenes, independently reviewed labels, diverse visual domains, and per-video results.

## Deploy to Vercel

Add the same environment variables to the Vercel project, keeping every secret server-only, then deploy the application. Run this health check after deployment:

```bash
curl https://build-visual-rag-for-video.vercel.app/api/health
```

The endpoint reports whether Cloudinary, Supabase, and embeddings are configured without returning credential values. The verified public deployment returns HTTP 200 with all three services enabled.

## Verify the end-to-end result

Test the complete proof after local setup or deployment:

1. Open the [live SceneSeeker demo](https://build-visual-rag-for-video.vercel.app/).
2. Select **Load demo video**.
3. Wait for **Ready to search**.
4. Select one of the example searches.
5. Submit the question and open a result.
6. Confirm that the Cloudinary Video Player jumps to the cited scene.

For production traffic, add authentication, request quotas, rate limits, asset-retention rules, durable jobs, retry controls, and abuse monitoring.

## Limitations and production hardening

| Limitation | Production control to consider |
| --- | --- |
| Visual descriptions can omit subtle details | Evaluate prompts and models on representative videos, and preserve human review for consequential use cases |
| Scene boundaries may not match the ideal retrieval unit | Measure alternate segmentation and keep mappings to the original timestamps |
| Exact vector search becomes expensive at large scale | Evaluate HNSW or another index and measure filtered recall and latency |
| Browser polling can stop when a tab closes | Move analysis and indexing to a durable queue or workflow |
| Similarity is relevance, not factual certainty | Show source descriptions and playable citations instead of presenting an unsupported answer |
| A single-video benchmark does not prove general accuracy | Expand the labeled dataset across durations, subjects, cuts, motion, text, and lighting conditions |
| Public upload can be abused | Add identity, rate limits, quotas, moderation, deletion policy, and cost controls |

Visual transcription also does not replace speech transcription. A production video-search system can index visual scenes, spoken words, on-screen text, and structured asset metadata as separate evidence channels, then compare their contribution in evaluation.

## Frequently asked questions

### How can AI search video content that has no speech?

Generate timestamped descriptions of what is visible, embed each description, embed the user's question with the same model, and retrieve the closest scene vectors. Return the original scene time range so the result can be verified in the source video.

### Is this actually RAG if there is no generative answer?

It is the retrieval and grounding layer required by a Visual RAG system. The demo intentionally stops at ranked evidence and timestamp citations. A generative model can be added after retrieval, but its answers should remain grounded in and linked to those scenes.

### Why use Cloudinary AI Video Analysis instead of a speech transcript?

Speech transcripts describe audio. Cloudinary AI Video Analysis describes visible scenes and returns their start and end times, so it can retrieve actions, objects, settings, and changes that are never spoken.

### Why store exact timestamps with every embedding?

An embedding identifies semantic similarity but does not preserve provenance by itself. Storing `start_time` and `end_time` beside the description lets every result cite and play the source evidence.

### Can I use another embedding model?

Yes, but query and document embeddings must come from the same compatible model and dimension. Update the Postgres vector type if the dimension changes, then re-embed every scene. Do not mix vector spaces from different models.

### What happens while Cloudinary analysis is pending?

The application stores the Cloudinary job ID and keeps the video in the `analyzing` state. Polling requests read the current job state. Search remains unavailable until the transcript is persisted and all scene embeddings are stored.

### Does the 30-question benchmark prove production accuracy?

No. It proves that the specific pipeline and labeled sea-turtle dataset produced the reported result. Broader claims require a larger, more diverse, independently reviewed benchmark.

## Conclusion

Silent video becomes searchable when visual evidence is converted into timestamped descriptions and those descriptions remain linked to their source scenes. Cloudinary stores the video, generates the visual transcript, and plays cited moments. Gemini creates retrieval embeddings, while Supabase `pgvector` ranks the matching scenes.

The most important design choice is not the search box. It is preserving provenance from the Cloudinary transcript through vector storage to the final player action. That is what turns a plausible semantic match into a timestamped, verifiable citation.
