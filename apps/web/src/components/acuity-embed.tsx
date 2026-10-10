import Script from "next/script";
import { bookingUrl } from "@/lib/site";

export function AcuityEmbed({ typeId }: { typeId?: number }) {
  return (
    <div className="bg-bone overflow-hidden rounded-xl">
      <iframe
        src={bookingUrl(typeId)}
        title="Book an appointment"
        className="block h-[1100px] w-full border-0"
        loading="lazy"
      />
      <Script src="https://embed.acuityscheduling.com/js/embed.js" strategy="lazyOnload" />
    </div>
  );
}
