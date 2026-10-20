import Link from "next/link";
import { getCMS } from "@/lib/cms";

export async function ServiceList() {
  const payload = await getCMS();
  const { docs: services } = await payload.find({
    collection: "services", where: { active: { equals: true } }, sort: "sortOrder", pagination: false,
  });
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
              </p>
              <p className="text-sand text-sm">{s.description} / {s.durationMinutes} min</p>
            </div>
            <span className="font-display text-reef text-4xl">${(s.priceCents / 100).toFixed(s.priceCents % 100 ? 2 : 0)}</span>
            <span className="text-ember font-display hidden text-lg tracking-widest opacity-0 transition-opacity group-hover:opacity-100 md:inline">
              Book →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
