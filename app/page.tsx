import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-zinc-950">
      <div className="max-w-xl w-full text-center">
        <div className="mb-8">
          <span className="inline-block bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-widest mb-4">
            Beta
          </span>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Know the moment your watchlist hits streaming
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Connect your Letterboxd watchlist and get notified when films become available on your streaming services. No more manually checking.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/auth"
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-colors"
          >
            Get started — it&apos;s free
          </Link>
          <a
            href="https://letterboxd.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            What&apos;s Letterboxd?
          </a>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-6 text-left">
          {[
            { title: 'Your watchlist, synced', body: 'We pull your public Letterboxd watchlist automatically.' },
            { title: 'Streaming only', body: 'We only surface subscription streaming — no rentals, no purchases.' },
            { title: 'Clearly flagged as new', body: 'Films that just hit streaming are marked so you spot them instantly.' },
          ].map(f => (
            <div key={f.title} className="bg-zinc-900 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
