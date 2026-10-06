export function Footer() {
  return (
    <footer className="container-page border-hairline relative z-10 mt-16 border-t py-10">
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-ink-faint text-sm">
          Astra OS design system · token-driven, dark-first
        </p>
        <div className="flex items-center gap-3">
          <span className="text-ink-ghost font-mono text-xs">
            src/styles/tokens.css
          </span>
          <span className="rounded-pill bg-ink-ghost h-1 w-1" />
          <span className="text-ink-ghost font-mono text-xs">theme.css</span>
        </div>
      </div>
    </footer>
  );
}
