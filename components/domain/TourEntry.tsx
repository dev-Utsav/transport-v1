import type { Strings } from "@/content/strings";
import { startPractice } from "@/server/actions/practice";

/** "Take the tour" and "Practice desk": both open the practice desk on fresh sample data. */
export function TourEntry({ t }: { t: Strings }) {
  return (
    <section
      className="grid gap-3 rounded-card bg-road p-5 text-road-text shadow-lift"
      aria-labelledby="tour-entry"
    >
      <div>
        <h2 id="tour-entry" className="text-[18px] font-bold">
          {t.start.tour}
        </h2>
        <p className="text-[15px] text-road-muted">{t.start.tourHelp}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <form action={startPractice}>
          <input type="hidden" name="tour" value="1" />
          <button className="min-h-12 rounded-field bg-road-signal px-5 font-semibold text-road">
            {t.tour.start}
          </button>
        </form>
        <form action={startPractice}>
          <button className="min-h-12 rounded-field px-5 font-semibold text-road-text ring-1 ring-road-muted">
            {t.practice.open}
          </button>
        </form>
      </div>
    </section>
  );
}
