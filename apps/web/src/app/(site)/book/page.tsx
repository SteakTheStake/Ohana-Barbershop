import { Suspense } from "react";
import type { Metadata } from "next";
import { BookClient } from "./book-client";

export const metadata: Metadata = {
  title: "Book",
  description:
    "Book directly with Ohana Barbershop in Albany, OR. Choose your cut and time, then sign in securely with your phone.",
  openGraph: {
    title: "Book | Ohana Barbershop",
    description:
      "Choose your cut and time, then sign in securely with your phone.",
    images: ["/large-logo.png"],
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
