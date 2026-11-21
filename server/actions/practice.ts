"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getPracticeDb } from "@/server/db";
import { resetSample } from "@/server/db/sample";
import { assertAdmin } from "@/server/guard";
import { PRACTICE_COOKIE } from "@/server/practice-flag";

/** Opens the practice desk with fresh sample data; with tour=1 the guided tour starts on Home. */
export async function startPractice(formData: FormData): Promise<void> {
  await assertAdmin();
  await resetSample(await getPracticeDb());
  (await cookies()).set(PRACTICE_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 12 * 60 * 60,
  });
  redirect(formData.get("tour") === "1" ? "/?tour=start" : "/");
}

export async function resetPractice(): Promise<void> {
  await assertAdmin();
  await resetSample(await getPracticeDb());
  redirect("/");
}

export async function leavePractice(): Promise<void> {
  await assertAdmin();
  (await cookies()).delete(PRACTICE_COOKIE);
  redirect("/");
}
