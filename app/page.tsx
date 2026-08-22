export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-6 py-16 lg:px-8">
      <div className="flex max-w-3xl flex-col gap-5">
        <p className="text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Cloudinary AI Video Analysis + pgvector
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Search what happens on screen, then cite the exact moment.
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
          SceneSeeker turns Cloudinary visual transcripts into searchable scene
          embeddings for videos whose audio cannot answer the question.
        </p>
      </div>

      <section aria-labelledby="foundation-heading" className="grid gap-4 md:grid-cols-3">
        <h2 id="foundation-heading" className="sr-only">
          Build foundation
        </h2>
        {[
          ["1", "Analyze", "Generate timestamped visual scene descriptions in Cloudinary."],
          ["2", "Retrieve", "Store scene embeddings in Supabase pgvector and rank by meaning."],
          ["3", "Cite", "Seek the Cloudinary Video Player to the returned start time."],
        ].map(([number, title, description]) => (
          <article key={number} className="flex flex-col gap-3 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{number}</p>
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="leading-7 text-muted-foreground">{description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
