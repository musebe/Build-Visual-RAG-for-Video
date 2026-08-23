# SceneSeeker

SceneSeeker is a Next.js and Cloudinary visual retrieval-augmented generation (RAG) demo. It searches what appears in videos even when speech transcripts contain no useful answer, then returns citations that seek the Cloudinary Video Player to the matching scene.

## Verifiable proof

For every indexed video, the application reads Cloudinary's timestamped visual transcript, stores one embedding per scene in Supabase `pgvector`, and returns the source video, scene description, start time, end time, and similarity score for each search result.

## Architecture

```text
Video upload
  -> Cloudinary video asset
  -> Cloudinary AI Video Analysis job (Beta)
  -> Cloudinary raw visual-transcript asset
  -> validated scene segments with timestamps
  -> Gemini retrieval embeddings
  -> Supabase pgvector
  -> semantic search
  -> timestamped Cloudinary Video Player citation
```

Cloudinary remains the source of truth for the video and generated visual transcript. Supabase stores application workflow state, scene records, vector embeddings, and benchmark judgments.

## Stack

- Next.js 16 and React 19, scaffolded with [`create-cloudinary-next`](https://github.com/cloudinary-devs/create-cloudinary-next)
- Cloudinary Node.js SDK, AI Video Analysis API, raw transcript assets, and Cloudinary Video Player
- Supabase Postgres with `pgvector`
- Gemini `gemini-embedding-2` with 1,536-dimensional output
- shadcn with Base UI and Tailwind CSS 4
- Vitest

## Status

The application, retrieval engine, benchmark workbench, and full tutorial are implemented. See the [article draft](docs/article.md), [setup](docs/setup.md), [architecture](docs/architecture.md), [benchmark protocol](docs/benchmark.md), and [article handoff](docs/article-handoff.md) for the complete build, API contract, constraints, evidence method, and editorial objective.

## Local setup

Copy the environment template and keep all API secrets server-only:

```bash
cp .env.example .env.local
npm install
npx supabase db push
npm run dev
```

Apply [`supabase/migrations/202608220001_visual_rag.sql`](supabase/migrations/202608220001_visual_rag.sql) in the Supabase SQL Editor if you do not use the Supabase CLI. The migration creates the `vector` extension, workflow tables, constraints, and server-only row-level security boundary.

Set `DEMO_VIDEO_ASSET_ID` to the immutable asset ID of a video already stored in the same Cloudinary product environment. The included demo configuration uses Cloudinary's `samples/sea-turtle` video. The application verifies that asset through the Admin API, analyzes and indexes it once, and reuses the resulting Supabase record on later visits.

The Cloudinary AI Video Analysis API is currently Beta. Confirm that your Cloudinary product environment can use it before testing. Parameter names and availability may change before general access. The application fails visibly when the product environment cannot access the API.

## Ingestion API

The primary interface calls `POST /api/videos/demo` to load the configured Cloudinary asset without uploading duplicate video bytes. Uploading another video remains available as a secondary path.

The browser asks `POST /api/uploads/sign` for constrained upload parameters, uploads the video directly to Cloudinary, then sends the returned `asset_id`, `public_id`, and original filename to `POST /api/videos`. The server reads the Cloudinary asset back by immutable ID before it starts analysis. Poll `GET /api/videos/:videoId` until the state advances from `analyzing` to `transcript_ready`.

This direct-upload design keeps large video bytes and Cloudinary credentials out of the Next.js function. The signature fixes the random public ID, formats, tags, context, delivery type, and overwrite behavior. The server independently checks Cloudinary's decoded format and file size during registration.

Call `POST /api/videos/:videoId/index` once the transcript is ready. The server embeds Cloudinary scene descriptions in bounded concurrent batches with `gemini-embedding-2` and stores all 1,536-dimensional vectors with their model name. `POST /api/videos/:videoId/search` embeds a natural-language query and calls a video-scoped cosine-search function. Documents and queries use Google's recommended retrieval prefixes, and every result preserves the Cloudinary scene's exact start and end times for player citations.

## Benchmark proof

Open `/benchmark?video=:videoId`, download the template, and use `GET /api/videos/:videoId/scenes` to label exactly 30 visual questions before saving the set. Placeholder questions, missing scene indexes, and timestamps beyond the source duration are rejected.

Each run preserves the question set version, Cloudinary analysis prompt, embedding model, threshold, result count, per-question rankings, and aggregate metrics. The workbench reports top-1 scene accuracy, top-3 scene recall, top-result timestamp overlap, and mean absolute start-time error separately.

The verified `sea-turtle-v1` run contains 30 human-labeled questions and measured 86.67% top-1 scene accuracy, 100% top-3 scene recall, 86.67% top-result timestamp overlap, and 0.73-second mean absolute start-time error. Read [the benchmark protocol and limitations](docs/benchmark.md) before citing those numbers.

## Validation

```bash
npm run check
```
