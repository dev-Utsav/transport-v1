import type { Lang } from "@/content/strings";
import { setLang } from "@/server/actions/session";

/** EN | हिं as two submit buttons: a plain form post, so it works before JS loads. */
export function LangSwitch({ lang, label }: { lang: Lang; label: string }) {
  const btn =
    "min-h-10 flex-1 rounded-[9px] px-3 text-[14px] font-semibold transition-colors duration-150";
  return (
    <form
      action={setLang}
      aria-label={label}
      data-tour="lang"
      className="flex gap-1 rounded-field bg-paper-deep p-1"
    >
      <button
        name="lang"
        value="en"
        aria-pressed={lang === "en"}
        className={`${btn} ${lang === "en" ? "bg-card text-ink shadow-card" : "text-ink-2"}`}
      >
        English
      </button>
      <button
        name="lang"
        value="hi"
        lang="hi"
        aria-pressed={lang === "hi"}
        className={`${btn} ${lang === "hi" ? "bg-card text-ink shadow-card" : "text-ink-2"}`}
      >
        हिंदी
      </button>
    </form>
  );
}
