# Editorial handoff: visual RAG for video with Cloudinary

## Article brief

**Title:** Build Visual RAG for Video: Search Silent Scenes and Cite Exact Timestamps With Cloudinary

**Deadline:** Sunday, August 23, 2026

**Category:** Multimodal AI

**Opportunity score:** 10/10. The new Cloudinary visual-transcription API makes a previously difficult silent-video retrieval workflow concrete, demonstrable, and timely.

**Buildability score:** 9/10. Cloudinary supplies scene descriptions and timestamps, while Supabase and a text embedding model provide a direct retrieval path; the remaining risk is Beta API access and asynchronous processing time.

### Article objective

Create semantic video search that understands visual scenes even when a video contains no useful speech.

### Technical stack

Next.js, Cloudinary AI Video Analysis API, Supabase `pgvector`, Gemini embeddings, Cloudinary Video Player, TypeScript, React, shadcn, and Vitest.

### Primary SEO focus

Visual RAG video, search inside video with AI, video semantic search, and timestamped video citations.

### Question the article should answer

How can an AI search video content that has no speech?

### Proof / GEO asset

A 30-question benchmark measuring top-1 scene accuracy, top-3 scene recall, timestamp overlap accuracy, and absolute start-time error.

### Article outline

1. Introduction
2. Why transcripts cannot search silent video
3. Visual RAG architecture
4. Uploading video to Cloudinary
5. Running AI Video Analysis
6. Generating visual scene descriptions
7. Preparing the visual transcript
8. Segmenting scene descriptions
9. Generating embeddings
10. Storing embeddings with pgvector
11. Building semantic search
12. Returning timestamped answers
13. Connecting results to Cloudinary Video Player
14. Building the 30-question benchmark
15. Measuring retrieval accuracy
16. Conclusion

### Research and notes

- [Cloudinary AI Video Analysis](https://cloudinary.com/documentation/ai_video_analysis) is currently Beta and generates a timestamped visual transcript for a video already stored in a Cloudinary product environment.
- Analysis is asynchronous: `POST /v2/video/{cloud_name}/ai_video_analysis` returns a `job_id`, and the corresponding `GET` returns a raw visual-transcript asset after completion.
- Each raw JSON segment contains `transcript`, `start_time`, and `end_time`. The API currently returns the transcript but not embeddings, summaries, titles, or tags.
- [Supabase semantic search](https://supabase.com/docs/guides/ai/semantic-search) uses the `pgvector` extension and recommends pushing metadata filters into the SQL matching function.
- [Gemini `gemini-embedding-2`](https://ai.google.dev/gemini-api/docs/embeddings) turns the Cloudinary-generated text into 1,536-dimensional vectors used for semantic comparison. It does not process the source video; Cloudinary remains the source of the timestamped visual evidence.
- Existing Cloudinary content discusses asset search, transcription, tagging, and video delivery. This article uniquely proves search inside silent video with timestamp-level retrieval and a reproducible accuracy benchmark.

### Code and implementation notes

- Have Next.js sign constrained `resource_type: "video"` parameters, then upload bytes directly from the browser to Cloudinary; never expose the Cloudinary API secret or proxy large video bodies through the serverless route.
- Call the Beta analysis endpoint with an `Authorization: Basic` header derived on the server, not credentials embedded in a logged URL.
- Persist the `job_id` before polling so asynchronous analysis can resume.
- Validate the raw transcript with Zod and use one Cloudinary scene segment per retrievable citation.
- Embed scene descriptions as retrieval documents, embed searches and benchmark questions as retrieval queries, and persist the model name with every vector.
- Filter Supabase similarity search by video inside the SQL function.
- Control `CldVideoPlayer` through `playerRef` and seek to the cited `start_time`.
- Keep benchmark labels separate from predictions and report all four retrieval metrics.

### Keyword and metadata table

| Primary keyword | Secondary keywords | Long-tail keywords | Meta title | Meta description |
| --- | --- | --- | --- | --- |
| visual RAG video | search inside video with AI; video semantic search; timestamped video citations; silent video search | how to search a video that has no speech; build visual RAG with Next.js and Cloudinary; semantic search over video scenes; return exact timestamps from AI video search | Build Visual RAG for Timestamped Video Search | Build visual RAG with Next.js and Cloudinary to search silent video scenes semantically, return exact timestamps, and measure retrieval accuracy. |

## Search and editorial brief

**Reader and problem:** A JavaScript developer building video search cannot rely on speech transcripts because the answer appears only on screen.

**Primary search intent:** Implementation and evaluation.

**Primary query:** How to build visual RAG for timestamped video search.

**Content gap and non-overlap claim:** Existing material explains video transcription, tagging, delivery, or asset-level search. This project retrieves scene-level visual descriptions from silent video, seeks the player to exact timestamps, and publishes a labeled 30-question benchmark.

**Demo proof:** A reviewer can submit a visual question, open the top result, and verify that the player seeks to the scene range generated by Cloudinary. The verified deployment is [build-visual-rag-for-video.vercel.app](https://build-visual-rag-for-video.vercel.app/).

**Original evidence:** The implemented demo and benchmark engine, Cloudinary raw transcript readback, persisted vectors, 30 labeled questions, raw benchmark runs, and accuracy calculations. The August 23, 2026 `sea-turtle-v1` run measured 86.67% top-1 scene accuracy, 100% top-3 scene recall, 86.67% top-result timestamp overlap, and 0.73-second mean absolute start-time error. The source is published at [musebe/Build-Visual-RAG-for-Video](https://github.com/musebe/Build-Visual-RAG-for-Video).

**Plan and product constraints:** Cloudinary AI Video Analysis is Beta. Access, pricing, rate limits, supported duration, and processing latency must be verified in the target product environment before publication.

**Publication readiness:** The implementation, real Beta API run, reusable Cloudinary demo asset, transcript readback, vector persistence, 30 human-labeled questions, stored benchmark result, public repository, canonical deployment, and deployment health check are verified. Before editorial publication, capture final screenshots without credentials and confirm whether the Cloudinary Blog editor wants the Beta label repeated in the introduction or only in prerequisites.

## Verified publication assets

| Asset | Location or result |
| --- | --- |
| Full article draft | [`docs/article.md`](article.md) |
| Live application | [build-visual-rag-for-video.vercel.app](https://build-visual-rag-for-video.vercel.app/) |
| Source repository | [musebe/Build-Visual-RAG-for-Video](https://github.com/musebe/Build-Visual-RAG-for-Video) |
| Benchmark dataset | [`benchmarks/sea-turtle-v1.json`](../benchmarks/sea-turtle-v1.json) |
| Benchmark run ID | `d9971196-38cc-4882-88aa-df2894c76316` |
| Demo video | Cloudinary `samples/sea-turtle`, 15.215 seconds, three visual scenes |
| Embedding configuration | `gemini-embedding-2`, 1,536 dimensions |
| Deployment health | HTTP 200; Cloudinary, database, and embeddings configured |

## Publication quality score

| Area | Score | Evidence |
| --- | ---: | --- |
| Search intent and direct answer | 15/15 | The introduction and FAQ directly answer how silent-video search works |
| Technical completeness | 19/20 | Covers Cloudinary setup, signed upload, analysis, transcript parsing, embeddings, vector search, citations, and deployment |
| Original proof and GEO value | 19/20 | Includes a versioned 30-question dataset, four metrics, misses, and explicit limits |
| Source quality | 15/15 | Uses primary Cloudinary, Supabase, Google, and RAG-paper references |
| Reproducibility | 14/15 | Public demo, source, migrations, environment template, code links, and test command are available |
| Trust and safety | 15/15 | Separates measured facts from general claims and documents security, scaling, and evaluation limits |
| **Total** | **97/100** | Ready for technical and editorial review after final screenshot capture |
