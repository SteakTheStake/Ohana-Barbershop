"use client";

import { useEffect, useState } from "react";

const greetings = {
  morning: { hi: "Aloha kakahiaka", en: "Good morning", say: "ah-LOH-hah kah-kah-hee-AH-kah" },
  afternoon: { hi: "Aloha ʻauinalā", en: "Good afternoon", say: "ah-LOH-hah ah-wee-nah-LAH" },
  evening: { hi: "Aloha ahiahi", en: "Good evening", say: "ah-LOH-hah ah-hee-AH-hee" },
};

const pick = (h: number) => (h >= 4 && h < 11 ? "morning" : h >= 11 && h < 17 ? "afternoon" : "evening");

export function Greeting() {
  const [g, setG] = useState<(typeof greetings)[keyof typeof greetings] | null>(null);

  useEffect(() => setG(greetings[pick(new Date().getHours())]), []);

  return (
    <p className="text-reef h-4 text-xs font-semibold tracking-[0.35em] uppercase" title={g?.say}>
      {g ? (
        <>
          {g.hi} <span className="text-sand/60 normal-case tracking-normal italic">· {g.en}</span>
        </>
      ) : (
        "Aloha"
      )}
    </p>
  );
}
