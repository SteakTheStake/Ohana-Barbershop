import Link from "next/link";
import { services } from "@/lib/site";

export function ServiceList() {
  return (
    <ul className="divide-lava border-lava divide-y border-y">
      {services.map((s) => (
        <li key={s.slug}>
          <Link
            href={`/book?service=${s.slug}`}
            className="group hover:bg-coal focus-visible:bg-coal flex items-center gap-4 px-2 py-5 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-reef md:px-4"
          >
            <div className="flex-1">
              <p className="font-display text-3xl tracking-wide">
                {s.name}
                {s.hawaiian && <span className="text-sand/70 ml-3 font-sans text-sm italic">{s.hawaiian}</span>}
              </p>
              <p className="text-sand text-sm">{s.blurb}</p>
            </div>
            <span className="font-display text-reef text-4xl">${s.price}</span>
            <span className="text-ember font-display hidden text-lg tracking-widest opacity-0 transition-opacity group-hover:opacity-100 md:inline">
              Book →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
