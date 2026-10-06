export function Hero() {
  return (
    <header className="container-page pt-section pb-16 text-center">
      <span className="eyebrow rounded-pill border-line bg-glass backdrop-blur-glass mb-6 inline-block border px-4 py-1.5">
        Astra OS · v1
      </span>
      <h1 className="text-gradient text-display mx-auto max-w-4xl font-semibold">
        The Astra design language
      </h1>
      <p className="text-lead text-ink-muted mx-auto mt-6 max-w-2xl">
        A dark-first system built on aura gradients, glass materials and
        luminous accents — inspired by Vision Pro, Arc, Linear and Vercel. Every
        value below is a CSS custom property mapped into Tailwind.
      </p>
    </header>
  );
}
