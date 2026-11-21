import { ButtonAnchor } from "@/components/ui/Button";
import { PrintButton } from "@/components/ui/PrintButton";
import type { Strings } from "@/content/strings";

/** Excel (CSV) download + Print / Save as PDF, the same pair on every report. */
export function ReportActions({ t, csvHref }: { t: Strings; csvHref: string }) {
  return (
    <>
      <ButtonAnchor href={csvHref} variant="secondary" icon="download">
        {t.common.exportCsv}
      </ButtonAnchor>
      <PrintButton label={`${t.common.print} / ${t.common.exportPdf}`} variant="secondary" />
    </>
  );
}
