import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { stringsFor } from "@/content/strings";
import type { Lang, Strings } from "@/content/strings";

export const LANG_COOKIE = "td_lang";

/** Language from the cookie (default English). Cached per request. */
export const getLang = cache(async (): Promise<Lang> => {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return value === "hi" ? "hi" : "en";
});

export const getT = cache(async (): Promise<Strings> => stringsFor(await getLang()));
