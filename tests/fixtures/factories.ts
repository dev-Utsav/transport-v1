import { createChallan } from "@/server/actions/challans";
import type { FormState } from "@/lib/form";
import { EMPTY_FORM } from "@/lib/form";
import { istDay } from "@/lib/dates";
import type { Database } from "@/server/db";
import { drivers, trips, trucks, vendors } from "@/server/db/schema";
import { RedirectSignal } from "@/tests/fixtures/signals";

/** Seed data builders: each test makes only the rows it needs, with unique names. */

let seq = 0;
const next = () => ++seq;

export function form(fields: Record<string, string | number | undefined>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) data.set(k, String(v));
  return data;
}

/** Runs a server action. A redirect is the success path; anything returned is a refused save. */
export async function run(
  call: () => Promise<FormState | void>,
): Promise<{ redirect: string } | { state: FormState | void }> {
  try {
    return { state: await call() };
  } catch (err) {
    if (err instanceof RedirectSignal) return { redirect: err.url };
    throw err;
  }
}

export async function expectRedirect(call: () => Promise<FormState | void>): Promise<string> {
  const out = await run(call);
  if (!("redirect" in out))
    throw new Error(`Expected a redirect, got ${JSON.stringify(out.state)}`);
  return out.redirect;
}

/** The id at the end of a redirect such as `/challans/12?saved=1`. */
export function idFrom(url: string): number {
  const match = /\/(\d+)(?:\?|$)/.exec(url);
  if (!match?.[1]) throw new Error(`No id in ${url}`);
  return Number(match[1]);
}

export async function makeParty(db: Database, over: Partial<typeof vendors.$inferInsert> = {}) {
  const [row] = await db
    .insert(vendors)
    .values({ name: `Party ${next()}`, phone: "9800000000", ...over })
    .returning();
  if (!row) throw new Error("party insert failed");
  return row;
}

export async function makeTruck(db: Database, over: Partial<typeof trucks.$inferInsert> = {}) {
  const [row] = await db
    .insert(trucks)
    .values({ number: `GJ05AB${String(next()).padStart(4, "0")}`, ...over })
    .returning();
  if (!row) throw new Error("truck insert failed");
  return row;
}

export async function makeDriver(db: Database, over: Partial<typeof drivers.$inferInsert> = {}) {
  const [row] = await db
    .insert(drivers)
    .values({ name: `Driver ${next()}`, ...over })
    .returning();
  if (!row) throw new Error("driver insert failed");
  return row;
}

export async function makeTrip(db: Database, over: Partial<typeof trips.$inferInsert> = {}) {
  const truck = over.truckId ? undefined : await makeTruck(db);
  const [row] = await db
    .insert(trips)
    .values({
      truckId: over.truckId ?? truck?.id ?? 0,
      fromPlace: "Kadodara",
      toPlace: "Delhi",
      departOn: istDay(),
      ...over,
    })
    .returning();
  if (!row) throw new Error("trip insert failed");
  return row;
}

/** Books a challan through the real action (validation, GST split, numbering, audit). */
export async function bookChallan(
  db: Database,
  fields: Record<string, string | number | undefined> = {},
): Promise<number> {
  const sender = fields.senderId ? undefined : await makeParty(db, { kind: "sender" });
  const receiver = fields.receiverId ? undefined : await makeParty(db, { kind: "receiver" });
  const url = await expectRedirect(() =>
    createChallan(
      EMPTY_FORM,
      form({
        bookedOn: istDay(),
        senderId: sender?.id,
        receiverId: receiver?.id,
        fromPlace: "Kadodara",
        toPlace: "Delhi",
        packages: 10,
        freight: "5000",
        payType: "to_pay",
        gstMode: "none",
        ...fields,
      }),
    ),
  );
  return idFrom(url);
}
