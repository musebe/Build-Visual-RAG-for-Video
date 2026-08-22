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

**Demo proof:** A reviewer can submit a visual question, open the top result, and verify that the player seeks to the scene range generated by Cloudinary.

**Original evidence:** The implemented demo and benchmark engine, Cloudinary raw transcript readback, persisted vectors, 30 labeled questions, raw benchmark runs, and accuracy calculations. Public deployment and repository URLs must be added after they exist.

**Plan and product constraints:** Cloudinary AI Video Analysis is Beta. Access, pricing, rate limits, supported duration, and processing latency must be verified in the target product environment before publication.

**Publication blockers:** Real Beta API access, a licensed silent-video dataset, all 30 benchmark labels, live transcript and vector readback, final accuracy results, sanitized screenshots, canonical URL, and deployment verification.
