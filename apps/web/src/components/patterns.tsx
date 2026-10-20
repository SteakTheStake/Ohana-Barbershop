// Polynesian-inspired motifs: niho manō (shark teeth), nalu (waves), honu (turtle).

export function NihoBand({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      aria-hidden
      className={`block h-4 w-full ${flip ? "rotate-180" : ""} ${className}`}
      preserveAspectRatio="none"
      viewBox="0 0 160 16"
    >
      <defs>
        <pattern id="niho" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M0 16 L8 2 L16 16 Z" fill="currentColor" />
          <path d="M5 16 L8 10 L11 16 Z" fill="var(--color-ink)" />
        </pattern>
      </defs>
      <rect width="160" height="16" fill="url(#niho)" />
    </svg>
  );
}

export function SectionTitle({
  kicker,
  title,
  as: Tag = "h2",
}: {
  kicker: string;
  title: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className="mb-10">
      <p className="text-reef text-xs font-semibold tracking-[0.3em] uppercase">{kicker}</p>
      <Tag className="font-display mt-1 text-5xl tracking-wide md:text-6xl">{title}</Tag>
      <NihoBand className="text-sand mt-3 !w-32" />
    </div>
  );
}
