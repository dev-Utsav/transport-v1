import { categoryLabel } from "@/content/strings";
import { formatChallanNo } from "@/lib/challan-no";
import { toCsv } from "@/lib/csv";
import { istDay, istMonth, isDay, isMonth } from "@/lib/dates";
import { getT } from "@/server/lang";
import { listExpenses } from "@/server/queries/money";
import { cashBook, gstSummary, tripProfit } from "@/server/queries/reports";
import { salaryRegister } from "@/server/queries/salary";
import { listVendorBalances, vendorLedger } from "@/server/queries/vendors";
import { getSettings } from "@/server/settings";
import { apiDenied } from "@/server/auth";

type Sheet = { name: string; header: string[]; rows: (string | number)[][] };

/**
 * Every report as CSV for Excel (and for the CA). Behind the login via proxy.ts.
 * Amounts are plain rupees (1,23,456.50 → "123456.50") so Excel can sum them.
 */
export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const denied = await apiDenied("reports.export");
  if (denied) return denied;
  const { report } = await params;
  const url = new URL(request.url);
  const month = isMonth(url.searchParams.get("month") ?? "")
    ? (url.searchParams.get("month") ?? "")
    : istMonth();
  const [t, settings] = await Promise.all([getT(), getSettings()]);
  const rupees = (paise: number) => (paise / 100).toFixed(2);
  const no = (n: number) => formatChallanNo(n, settings.challanPrefix);

  let sheet: Sheet | null = null;
  switch (report) {
    case "gst": {
      const data = await gstSummary(month);
      sheet = {
        name: `gst-${month}`,
        header: [
          t.challans.no,
          t.common.date,
          t.payments.party,
          "GSTIN",
          "GST %",
          t.gst.taxable,
          t.gst.tax,
          t.common.total,
        ],
        rows: data.rows.map((r) => [
          no(r.no),
          r.bookedOn,
          r.partyName,
          r.partyGstin,
          r.rateBp / 100,
          rupees(r.taxable),
          rupees(r.tax),
          rupees(r.total),
        ]),
      };
      break;
    }
    case "expenses": {
      const rows = (await listExpenses(month)).filter((r) => !r.isCancelled);
      sheet = {
        name: `expenses-${month}`,
        header: [
          t.common.date,
          t.expenses.category,
          t.common.amount,
          t.common.mode,
          t.expenses.truck,
          t.expenses.trip,
          t.common.note,
        ],
        rows: rows.map((r) => [
          r.spentOn,
          categoryLabel(t, r.category),
          rupees(r.amount),
          t.modes[r.mode],
          r.truckNumber ?? "",
          r.tripTo ?? "",
          r.note,
        ]),
      };
      break;
    }
    case "salary": {
      const rows = (await salaryRegister(month)).filter((r) => r.entry && r.pay);
      sheet = {
        name: `salary-${month}`,
        header: [
          t.common.name,
          t.salary.role,
          t.salary.monthly,
          t.salary.present,
          t.salary.absent,
          t.salary.half,
          t.salary.earned,
          t.salary.advance,
          t.salary.deduction,
          t.salary.net,
          t.salary.paidOn,
          t.common.mode,
        ],
        rows: rows.map(({ employee, entry, pay }) => [
          employee.name,
          t.roles[employee.role],
          rupees(entry?.monthlySalary ?? 0),
          entry?.present ?? 0,
          entry?.absent ?? 0,
          entry?.halfDays ?? 0,
          rupees(pay?.earned ?? 0),
          rupees(entry?.advance ?? 0),
          rupees(entry?.deduction ?? 0),
          rupees(pay?.net ?? 0),
          entry?.paidOn ?? "",
          entry?.paidMode ? t.modes[entry.paidMode] : "",
        ]),
      };
      break;
    }
    case "trip-profit": {
      const rows = await tripProfit(month);
      sheet = {
        name: `trip-profit-${month}`,
        header: [
          t.common.date,
          t.trips.truck,
          t.trips.from,
          t.trips.to,
          t.trips.freight,
          t.trips.expenses,
          t.trips.profit,
        ],
        rows: rows.map((r) => [
          r.departOn,
          r.truckNumber,
          r.fromPlace,
          r.toPlace,
          rupees(r.freight),
          rupees(r.spent),
          rupees(r.profit),
        ]),
      };
      break;
    }
    case "outstanding": {
      const rows = await listVendorBalances({ dueOnly: true });
      sheet = {
        name: `outstanding-${istDay()}`,
        header: [
          t.common.name,
          t.common.phone,
          t.vendors.openingRow,
          t.vendors.business,
          t.vendors.received,
          t.vendors.pending,
        ],
        rows: rows.map((r) => [
          r.name,
          r.phone,
          rupees(r.openingBalance),
          rupees(r.business),
          rupees(r.received),
          rupees(r.balance),
        ]),
      };
      break;
    }
    case "cash-book": {
      const day = isDay(url.searchParams.get("day") ?? "")
        ? (url.searchParams.get("day") ?? "")
        : istDay();
      const book = await cashBook(day);
      sheet = {
        name: `cash-book-${day}`,
        header: [t.common.date, "", t.reports.cashIn, t.reports.cashOut],
        rows: [
          [day, t.reports.opening, rupees(book.opening), ""],
          ...book.ins.map((r) => [day, `${r.name} ${r.note}`.trim(), rupees(r.amount), ""]),
          ...book.outs.map((r) => [
            day,
            `${categoryLabel(t, r.category)} ${r.note}`.trim(),
            "",
            rupees(r.amount),
          ]),
          ...book.sals.map((r) => [day, `${t.salary.title} ${r.name}`, "", rupees(r.amount)]),
          [day, t.reports.closing, rupees(book.closing), ""],
        ],
      };
      break;
    }
    case "ledger": {
      const vendorId = Number(url.searchParams.get("vendor"));
      const ledger =
        Number.isInteger(vendorId) && vendorId > 0
          ? await vendorLedger(vendorId, settings.challanPrefix)
          : null;
      if (ledger) {
        sheet = {
          name: `ledger-${ledger.vendor.name.replace(/[^\w]+/g, "-").toLowerCase()}`,
          header: [t.common.date, "", t.vendors.charged, t.vendors.paid, t.vendors.balance],
          rows: ledger.rows.map((r) => [
            r.day,
            r.kind === "opening" ? t.vendors.openingRow : r.label,
            r.debit ? rupees(r.debit) : "",
            r.credit ? rupees(r.credit) : "",
            rupees(r.balance),
          ]),
        };
      }
      break;
    }
  }
  if (!sheet) return new Response("Not found", { status: 404 });
  return new Response(toCsv(sheet.header, sheet.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sheet.name}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
