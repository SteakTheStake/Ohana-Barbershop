export type IconName = "coral" | "flower" | "puff" | "star" | "surf" | "turtle" | "wave";

// Renders /public/icons/*.svg as a mask so it inherits currentColor.
export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const url = `url(/icons/${name}.svg)`;
  return (
    <span
      aria-hidden
      className={`inline-block ${className}`}
      style={{ maskImage: url, WebkitMaskImage: url, maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center" }}
    />
  );
}
