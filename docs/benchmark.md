# Benchmark protocol

The benchmark answers two separate questions:

1. Did semantic retrieval return the human-labeled scene?
2. Did the top citation point to the human-labeled time range?

## Labeling rules

- Write exactly 30 questions before running retrieval.
- Derive labels by watching the source video, not by reading the generated scene descriptions.
- Cover objects, actions, colors, settings, entrances and exits, ordering, and visually subtle changes.
- Avoid questions answerable from the filename, speech transcript, or repeated boilerplate.
- Record the expected scene index and an acceptable start/end range before running the benchmark.
- Do not change a label after seeing retrieval results without recording a new benchmark version.

## Reported metrics

| Metric | Definition |
| --- | --- |
| Top-1 scene accuracy | Share of questions whose expected scene ranks first |
| Top-3 scene recall | Share whose expected scene appears in the first three |
| Timestamp overlap accuracy | Share whose top result overlaps the labeled time interval |
| Mean start-time error | Mean absolute difference between top-result and labeled start times |

Every run uses unthresholded top-three retrieval. This prevents a tuned similarity threshold from silently excluding difficult results and inflating the reported evidence. Store the source video, Cloudinary visual-transcription prompt, embedding model, benchmark version, question labels, run date, and raw result rows with any published result.

## Verified sea-turtle run

The first reproducible run was completed on August 23, 2026, against Cloudinary's 15.215-second `samples/sea-turtle` video. Cloudinary AI Video Analysis divided the video into three timestamped visual scenes. The [`sea-turtle-v1` question set](../benchmarks/sea-turtle-v1.json) contains 30 questions labeled from source-video playback before retrieval: ten questions for each scene.

| Metric | Result |
| --- | ---: |
| Top-1 scene accuracy | 86.67% (26/30) |
| Top-3 scene recall | 100% (30/30) |
| Top-result timestamp overlap | 86.67% (26/30) |
| Mean absolute start-time error | 0.73 seconds |

The run used Cloudinary's three scene descriptions, `gemini-embedding-2` at 1,536 dimensions, cosine similarity, no retrieval threshold, and three returned results. Supabase persisted run ID `d9971196-38cc-4882-88aa-df2894c76316` with the question version, analysis prompt, embedding model, raw result rows, and aggregate metrics.

Four opening-scene questions ranked another scene first. All four still retrieved the expected scene at rank three. The misses involved language such as “turn,” “before it approaches,” and “angled across the frame,” which overlaps with the turtle's movement in later scenes.

This is a controlled retrieval test, not a general video-search accuracy claim. Because the corpus contains one short video and exactly three indexed scenes, returning three results makes top-3 recall an intentionally weak metric. A publication update should add longer silent videos, more scene boundaries, independently reviewed labels, and per-video results before generalizing the measured accuracy.
