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
  -> OpenAI text embeddings
  -> Supabase pgvector
  -> semantic search
  -> timestamped Cloudinary Video Player citation
```

Cloudinary remains the source of truth for the video and generated visual transcript. Supabase stores application workflow state, scene records, vector embeddings, and benchmark judgments.

## Stack

- Next.js 16 and React 19, scaffolded with [`create-cloudinary-next`](https://github.com/cloudinary-devs/create-cloudinary-next)
- Cloudinary Node.js SDK, AI Video Analysis API, raw transcript assets, and Cloudinary Video Player
- Supabase Postgres with `pgvector`
- OpenAI `text-embedding-3-small`
- shadcn with Base UI and Tailwind CSS 4
- Vitest

## Status

The project is being built in recoverable feature checkpoints. See [the architecture](docs/architecture.md) and [article handoff](docs/article-handoff.md) for the verified API contract, constraints, benchmark plan, and editorial objective.

## Local setup

Copy the environment template and keep all API secrets server-only:

```bash
cp .env.example .env.local
npm install
npm run dev
```

The Cloudinary AI Video Analysis API is currently Beta. Parameter names and availability may change before general access. The application must fail visibly when the product environment cannot access the API.

## Validation

```bash
npm run check
```
