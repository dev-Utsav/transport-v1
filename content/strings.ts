import { en } from "@/content/strings.en";
import { hi } from "@/content/strings.hi";

type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };

export type Strings = DeepString<typeof en>;
export const LANGS = ["en", "hi"] as const;
export type Lang = (typeof LANGS)[number];

export function stringsFor(lang: Lang): Strings {
  return lang === "hi" ? hi : en;
}

/** Fills `{name}` placeholders: fill("Hi {name}", { name: "Ravi" }). */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(vars[key] ?? match));
}

/** Label for an expense category: built-ins are translated, custom ones show as typed. */
export function categoryLabel(t: Strings, category: string): string {
  return isBuiltInCategory(t, category) ? t.categories[category] : category;
}

function isBuiltInCategory(t: Strings, category: string): category is keyof Strings["categories"] {
  return Object.hasOwn(t.categories, category);
}
