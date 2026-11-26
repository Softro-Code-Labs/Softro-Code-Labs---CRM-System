import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { CRIMSON, INK, LIGHT, LINE, Mark, MUTED, SealedSignaturePdf } from "./shared";
import type { SealInfo } from "@/lib/seal";
import type { getOrgSettings } from "@/lib/queries/org";
import type { IncomeSummary } from "@/lib/finance";
import { PAYMENT_METHOD_LABELS } from "@/lib/crm-meta";
import { formatDate, formatMoney, fullName } from "@/lib/utils";

type Org = Awaited<ReturnType<typeof getOrgSettings>>;

const s = StyleSheet.create({
  page: { fontFamily: "Geist", fontSize: 9, color: INK, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 40, lineHeight: 1.4 },
  row: { flexDirection: "row" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 14, marginBottom: 16 },
  orgName: { fontSize: 13, fontWeight: 600 },
  small: { fontSize: 8, color: MUTED },
  title: { fontSize: 18, fontWeight: 600, textAlign: "right", lineHeight: 1.15 },
  sub: { fontSize: 9, color: CRIMSON, textAlign: "right", marginTop: 5, fontWeight: 500 },
  h2: { fontSize: 11, fontWeight: 600, marginTop: 16, marginBottom: 6 },
  tiles: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, borderWidth: 0.75, borderColor: LINE, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10 },
  tileLabel: { fontSize: 7, fontWeight: 600, color: LIGHT, textTransform: "uppercase", letterSpacing: 0.5 },
  tileValue: { fontSize: 12, fontWeight: 600, marginTop: 3 },
  th: { flexDirection: "row", backgroundColor: "#f3f1ec", borderBottomWidth: 0.75, borderBottomColor: LINE, paddingVertical: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 4 },
  total: { flexDirection: "row", borderTopWidth: 1, borderTopColor: INK, paddingVertical: 4 },
  cellHead: { fontSize: 7.5, fontWeight: 600, color: MUTED, paddingHorizontal: 4 },
  cell: { fontSize: 8, paddingHorizontal: 4 },
  num: { textAlign: "right" },
  note: { fontSize: 7.5, color: MUTED, marginTop: 4 },
  signLine: { borderBottomWidth: 0.75, borderBottomColor: MUTED, height: 34, marginBottom: 4 },
  footerLine: { position: "absolute", bottom: 38, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: LINE },
  footerLeft: { position: "absolute", bottom: 24, left: 40, fontSize: 7, color: LIGHT },
  footerRight: { position: "absolute", bottom: 24, left: 300, right: 40, fontSize: 7, color: LIGHT, textAlign: "right" },
});

const lkr = (v: number) => (v ? formatMoney(v, "LKR") : "—");

type Col = { label: string; width: number | string; num?: boolean };
function Table({ cols, rows, total }: { cols: Col[]; rows: (string | number)[][]; total?: (string | number)[] }) {
  const cell = (c: Col, v: string | number, i: number, bold?: boolean) => (
    <Text key={i} style={[s.cell, { width: c.width as number }, c.num ? s.num : {}, bold ? { fontWeight: 600 } : {}]}>
      {v}
    </Text>
  );
  return (
    <View>
      <View style={s.th} fixed>
        {cols.map((c, i) => (
          <Text key={i} style={[s.cellHead, { width: c.width as number }, c.num ? s.num : {}]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={s.tr} wrap={false}>
          {cols.map((c, i) => cell(c, r[i], i))}
        </View>
      ))}
      {total ? (
        <View style={s.total} wrap={false}>
          {cols.map((c, i) => cell(c, total[i], i, true))}
        </View>
      ) : null}
    </View>
  );
}

function IncomePdf({ sum, org, period, scope, seal, preparedBy }: { sum: IncomeSummary; org: Org; period: string; scope: string; seal: SealInfo | null; preparedBy: string }) {
  const orgLine = [org.phone, org.email, org.website?.replace(/^https?:\/\//, "")].filter(Boolean).join("  ·  ");
  const idLine = [org.registrationNo && `BR ${org.registrationNo}`, org.vatNumber && `TIN/VAT ${org.vatNumber}`].filter(Boolean).join("  ·  ");
  const party = (l: IncomeSummary["lines"][number]) => l.p.invoice.company?.name ?? (l.p.invoice.contact ? fullName(l.p.invoice.contact) : "—");

  return (
    <Document title={`Income report ${period}`} author={org.companyName} subject="Income report for the accountant" creator="Softro CRM">
      <Page size="A4" style={s.page}>
        <View style={s.footerLine} fixed />
        <Text style={s.footerLeft} fixed>
          {org.companyName} · Income report
        </Text>
        <Text style={s.footerRight} fixed>
          {period}
        </Text>

        <View style={s.header}>
          <View style={[s.row, { gap: 10, flex: 1, paddingRight: 20 }]}>
            <Mark />
            <View style={{ flex: 1 }}>
              <Text style={s.orgName}>{org.companyName}</Text>
              {org.address ? <Text style={s.small}>{org.address}</Text> : null}
              {orgLine ? <Text style={s.small}>{orgLine}</Text> : null}
              {idLine ? <Text style={s.small}>{idLine}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={s.title}>Income report</Text>
            <Text style={s.sub}>{period}</Text>
            <Text style={[s.small, { textAlign: "right", marginTop: 3 }]}>{scope}</Text>
            <Text style={[s.small, { textAlign: "right" }]}>Prepared {formatDate(new Date())}</Text>
          </View>
        </View>

        <View style={s.tiles}>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Total income</Text>
            <Text style={s.tileValue}>{formatMoney(sum.income, "LKR")}</Text>
            <Text style={s.small}>
              Without VAT · {sum.paymentCount} {sum.paymentCount === 1 ? "payment" : "payments"}
            </Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Local</Text>
            <Text style={s.tileValue}>{formatMoney(sum.localIncome, "LKR")}</Text>
            <Text style={s.small}>Paid in rupees</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Export</Text>
            <Text style={s.tileValue}>{formatMoney(sum.exportIncome, "LKR")}</Text>
            <Text style={s.small}>Foreign currency via bank</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>VAT</Text>
            <Text style={s.tileValue}>{formatMoney(sum.vat, "LKR")}</Text>
            <Text style={s.small}>Collected, payable to the IRD</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Commission</Text>
            <Text style={s.tileValue}>{formatMoney(sum.commissions, "LKR")}</Text>
            <Text style={s.small}>Earned on these payments</Text>
          </View>
        </View>

        <Text style={s.h2}>By month</Text>
        <Table
          cols={[
            { label: "Month", width: "22%" },
            { label: "Local", width: "16%", num: true },
            { label: "Export", width: "16%", num: true },
            { label: "Total income", width: "16%", num: true },
            { label: "VAT", width: "14%", num: true },
            { label: "Commission", width: "16%", num: true },
          ]}
          rows={sum.months.map((m) => [m.label, lkr(m.local), lkr(m.export), lkr(m.local + m.export), lkr(m.vat), lkr(m.commissions)])}
          total={["Total", lkr(sum.localIncome), lkr(sum.exportIncome), lkr(sum.income), lkr(sum.vat), lkr(sum.commissions)]}
        />

        <Text style={s.h2}>Payments received</Text>
        {sum.lines.length === 0 ? (
          <Text style={s.small}>No payments in this period.</Text>
        ) : (
          <Table
            cols={[
              { label: "Date", width: "11%" },
              { label: "Receipt / invoice", width: "19%" },
              { label: "Client", width: "20%" },
              { label: "Method", width: "13%" },
              { label: "Amount paid", width: "13%", num: true },
              { label: "LKR without VAT", width: "13%", num: true },
              { label: "VAT LKR", width: "11%", num: true },
            ]}
            rows={sum.lines.map((l) => [
              formatDate(l.p.paidAt),
              `${l.p.receiptNumber}\n${l.p.invoice.number}`,
              party(l),
              PAYMENT_METHOD_LABELS[l.p.method],
              formatMoney(l.p.amount, l.p.invoice.currency),
              l.split ? lkr(l.split.net) + (l.split.foreign ? " *" : "") : "no LKR amount",
              l.split ? lkr(l.split.vat) : "—",
            ])}
            total={["Total", "", "", "", "", lkr(sum.income), lkr(sum.vat)]}
          />
        )}
        <Text style={s.note}>* Export of services: foreign currency received through a bank in Sri Lanka. Amounts are in rupees as credited.</Text>

        {sum.commissionByPerson.length > 0 && (
          <View wrap={false}>
            <Text style={s.h2}>Sales commission by person</Text>
            <Table
              cols={[
                { label: "Person", width: "40%" },
                { label: "Earned", width: "20%", num: true },
                { label: "Paid out", width: "20%", num: true },
                { label: "Still to pay", width: "20%", num: true },
              ]}
              rows={sum.commissionByPerson.map((r) => [r.name, lkr(r.earned), lkr(r.paid), lkr(r.earned - r.paid)])}
              total={["Total", lkr(sum.commissions), lkr(sum.commissionByPerson.reduce((a, r) => a + r.paid, 0)), lkr(sum.commissionByPerson.reduce((a, r) => a + r.earned - r.paid, 0))]}
            />
          </View>
        )}

        <Text style={[s.note, { marginTop: 10 }]}>
          Cash basis: income counts on the date the client paid. Expenses, payroll and income tax are not in this report; they come from the accountant&apos;s books.
        </Text>

        {/* Fills the rest of the page, so the signature sits at the bottom of the last page. */}
        <View style={{ flexGrow: 1 }} />
        <View style={[s.row, { justifyContent: "flex-end", marginTop: 40 }]} wrap={false}>
          {seal ? (
            <SealedSignaturePdf seal={seal} registrationNo={org.registrationNo} width={230} caption={`For ${org.companyName}`} />
          ) : (
            <View style={{ width: 210 }}>
              <View style={s.signLine} />
              <Text style={s.small}>Prepared by: {preparedBy}</Text>
              <Text style={s.small}>For {org.companyName}</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}

export function renderIncomePdf(args: { sum: IncomeSummary; org: Org; period: string; scope: string; seal: SealInfo | null; preparedBy: string }) {
  return renderToBuffer(<IncomePdf {...args} />);
}
