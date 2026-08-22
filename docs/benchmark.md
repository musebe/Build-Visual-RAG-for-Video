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

## Claim status

The repository contains the benchmark engine and a 30-question template, but no accuracy number should be published until a real silent-video corpus is uploaded, independently labeled, and run end to end with configured Cloudinary, Supabase, and OpenAI accounts.

