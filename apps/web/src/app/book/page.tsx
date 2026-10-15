import { Suspense } from "react";
import type { Metadata } from "next";
import { BookClient } from "./book-client";

export const metadata: Metadata = {
  title: "Book",
  description:
    "Book your haircut, skin fade, or beard trim at Ohana Barbershop in Albany, OR. Online scheduling powered by Acuity.",
  openGraph: {
    title: "Book | Ohana Barbershop",
    description:
      "Book your haircut, skin fade, or beard trim at Ohana Barbershop in Albany, OR. Online scheduling powered by Acuity.",
    images: ["/logo.webp"],
  },
};

export default function Book() {
  return (
    <Suspense fallback={<BookSkeleton />}>
      <BookClient />
    </Suspense>
  );
}

function BookSkeleton() {
  return (
    <section className="mx-auto max-w-4xl px-5 pt-16">
      <div className="bg-coal h-8 w-48 animate-pulse rounded" />
      <div className="bg-bone mt-10 h-[1100px] w-full rounded-xl" />
    </section>
  );
}
