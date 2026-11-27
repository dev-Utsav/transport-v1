"use server";

import { cookies } from "next/headers";
import { redirect, RedirectType } from "next/navigation";

import { getPracticeDb } from "@/server/db";
import { resetSample } from "@/server/db/sample";
import { assertCan } from "@/server/auth";
import { PRACTICE_COOKIE } from "@/server/practice-flag";

/** Screens with a practice / tour button, where a failed start comes back to. */
const ENTRY_SCREENS = ["/", "/more", "/settings"] as const;

/**
 * Opens the practice desk with fresh sample data; with tour=1 the guided tour starts on Home.
 * If the practice database can't open, the person goes back to the screen they came from with a
 * message (never the error screen); the real desk is untouched. The cause goes to the logs.
 */
export async function startPractice(formData: FormData): Promise<void> {
  await assertCan();
  const from = ENTRY_SCREENS.find((p) => p === formData.get("from")) ?? "/";
  try {
    await resetSample(await getPracticeDb());
  } catch (err) {
    console.error("[practice] could not open the practice desk:", err);
    redirect(`${from}?practice=failed`, RedirectType.replace);
  }
  (await cookies()).set(PRACTICE_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 12 * 60 * 60,
  });
  redirect(formData.get("tour") === "1" ? "/?tour=start" : "/", RedirectType.replace);
}

export async function resetPractice(): Promise<void> {
  await assertCan();
  await resetSample(await getPracticeDb());
  redirect("/", RedirectType.replace);
}

export async function leavePractice(): Promise<void> {
  await assertCan();
  (await cookies()).delete(PRACTICE_COOKIE);
  redirect("/", RedirectType.replace);
}
