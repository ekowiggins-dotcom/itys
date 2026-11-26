/** The waitlist page in English and Turkish (the Instagram ads run in both). */
export type WaitlistLocale = "en" | "tr";

/** ?lang=tr or ?lang=en wins; otherwise the browser's first matching language; English by default. */
export function pickLocale(lang: string | null | undefined, acceptLanguage: string | null | undefined): WaitlistLocale {
  if (lang === "tr" || lang === "en") return lang;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const code = part.split(";")[0].trim().toLowerCase().slice(0, 2);
    if (code === "tr" || code === "en") return code;
  }
  return "en";
}

export const WAITLIST_COPY = {
  en: {
    title: "Join the waitlist",
    lede: "Who’ll is a friendly prediction game for your group: make calls about plans and life, everyone picks, and points go to whoever saw it coming.",
    free: "Free for up to 4 friends. No money, no prizes, just bragging rights.",
    email: "Email",
    size: "How many friends would join your group?",
    optional: "optional",
    sizes: { "2-4": "2–4", "5-8": "5–8", "9+": "9+" },
    submit: "Join the waitlist",
    note: "We’ll only email you when Who’ll is ready for you. Nothing else.",
    privacy: "Privacy",
    thanksTitle: "You’re on the list!",
    thanksText: "We’ll email you when Who’ll is ready. Start thinking about your first call.",
    badEmail: "Enter a valid email address.",
    tooMany: "Too many tries. Please wait a little and try again.",
    failed: "Something went wrong. Please try again.",
  },
  tr: {
    title: "Bekleme listesine katıl",
    lede: "Who’ll, arkadaş grubun için eğlenceli bir tahmin oyunu: planlar ve hayat hakkında tahmin yap, herkes seçimini yapsın, puanlar doğru bilene gitsin.",
    free: "4 kişiye kadar ücretsiz. Para yok, ödül yok, sadece hava atmak var.",
    email: "E-posta",
    size: "Grubuna kaç arkadaşın katılır?",
    optional: "isteğe bağlı",
    sizes: { "2-4": "2–4", "5-8": "5–8", "9+": "9+" },
    submit: "Bekleme listesine katıl",
    note: "Sana yalnızca Who’ll hazır olduğunda e-posta göndereceğiz. Başka bir şey değil.",
    privacy: "Gizlilik",
    thanksTitle: "Listedesin!",
    thanksText: "Who’ll hazır olduğunda sana e-posta göndereceğiz. İlk tahminini şimdiden düşünmeye başla.",
    badEmail: "Geçerli bir e-posta adresi gir.",
    tooMany: "Çok fazla deneme oldu. Biraz bekleyip tekrar dene.",
    failed: "Bir şeyler ters gitti. Lütfen tekrar dene.",
  },
} as const;
