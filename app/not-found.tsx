import Link from "next/link";

import { getT } from "@/server/lang";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4">
      <div className="grid max-w-sm gap-4 text-center">
        <p className="font-mono text-[15px] text-ink-2">404</p>
        <h1 className="text-[26px] font-bold">{t.common.notFound}</h1>
        <Link
          href="/"
          className="mx-auto inline-flex min-h-12 items-center rounded-field bg-signal px-5 font-semibold text-card"
        >
          {t.common.goHome}
        </Link>
      </div>
    </div>
  );
}
