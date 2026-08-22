# SceneSeeker setup

## 1. Cloudinary

1. Create or select a Cloudinary product environment.
2. Copy its cloud name, API key, and API secret from **Settings → API Keys**.
3. Confirm that the product environment has access to the **AI Video Analysis API (Beta)**. This is an API capability, not one of the similarly named Marketplace tagging or transcription add-ons.
4. Keep the API key and secret on the server. Only the cloud name uses the `NEXT_PUBLIC_` prefix.

The browser never receives the API secret. It requests signed parameters from Next.js and uploads video bytes directly to Cloudinary. The registration route then reads the asset back by immutable `asset_id` and verifies the signed ingestion marker, generated public-ID namespace, decoded format, and actual size.

Official references:

- [AI Video Analysis API](https://cloudinary.com/documentation/ai_video_analysis)
- [Generate upload signatures](https://cloudinary.com/documentation/authentication_signatures)
- [Upload API reference](https://cloudinary.com/documentation/image_upload_api_reference)
- [Cloudinary Video Player](https://cloudinary.com/documentation/cloudinary_video_player)

## 2. Supabase

Create a Supabase project and apply all SQL files in `supabase/migrations` in filename order. They:

1. Enable `pgvector` in the `extensions` schema.
2. Create the video workflow and timestamped scene tables.
3. Add the video-scoped cosine retrieval function.
4. Restrict that function to `service_role`.
5. Create the question, run, and result tables for the 30-question benchmark.
6. Enable row-level security without browser policies because this demo accesses the data only through server routes.

Use the Supabase secret or service-role key only in `SUPABASE_SECRET_KEY`. Never use it in a `NEXT_PUBLIC_` variable.

Official references:

- [Supabase semantic search](https://supabase.com/docs/guides/ai/semantic-search)
- [Supabase vector columns](https://supabase.com/docs/guides/ai/vector-columns)

## 3. OpenAI embeddings

Create an API key and set `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`. The database column is fixed at 1,536 dimensions to match that model's default output. A different embedding model requires a migration and a complete re-index; mixing models is rejected.

Official reference: [text-embedding-3-small](https://developers.openai.com/api/docs/models/text-embedding-3-small).

## 4. Environment variables

```bash
cp .env.example .env.local
```

Fill every value, then confirm configuration without exposing credential values:

```bash
npm run dev
curl http://localhost:3000/api/health
```

The expected response has `ok: true` and all three service booleans set to `true`.

## 5. Run the proof

1. Open `/` and upload an MP4, MOV, or WebM up to the configured byte limit.
2. Wait for `Ready to search`. Cloudinary analysis is asynchronous and may take several minutes.
3. Search for a visible object, action, setting, color, or on-screen change that is not discoverable from speech.
4. Select a result and verify that the Cloudinary Video Player seeks to the cited start time.
5. Open `/benchmark?video=<video-id>`.
6. View the scene catalog, download the template, and replace all 30 placeholders with human-authored labels.
7. Save and run the benchmark. Preserve the result rows before making an accuracy claim.

## 6. Deploy

Add the same environment variables to Vercel and deploy. The direct upload avoids routing video bytes through the Vercel function, but the analysis poll, embedding request, and benchmark runner still need suitable function-duration limits. For long videos or production traffic, move those stages to a durable background workflow and add authentication, quotas, rate limits, asset retention, and retry controls.

