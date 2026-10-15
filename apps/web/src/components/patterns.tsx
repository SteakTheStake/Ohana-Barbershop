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

export function WaveDivider({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`overflow-hidden ${className}`}>
      <svg className="animate-drift block h-10 w-[200%]" viewBox="0 0 1200 40" preserveAspectRatio="none">
        <path
          d="M0 20 Q 37.5 0 75 20 T 150 20 T 225 20 T 300 20 T 375 20 T 450 20 T 525 20 T 600 20 T 675 20 T 750 20 T 825 20 T 900 20 T 975 20 T 1050 20 T 1125 20 T 1200 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M0 30 Q 37.5 10 75 30 T 150 30 T 225 30 T 300 30 T 375 30 T 450 30 T 525 30 T 600 30 T 675 30 T 750 30 T 825 30 T 900 30 T 975 30 T 1050 30 T 1125 30 T 1200 30"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="2"
        />
      </svg>
    </div>
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
