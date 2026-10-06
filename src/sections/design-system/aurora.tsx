/** Ambient aura blobs behind the page — pure token usage, no props. */
export function Aurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="glow-blob bg-aura-violet/30 -top-40 -left-32 h-96 w-96" />
      <div className="glow-blob bg-aura-cyan/25 -top-24 right-0 h-80 w-80" />
      <div className="glow-blob bg-aura-fuchsia/20 top-1/3 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2" />
    </div>
  );
}
