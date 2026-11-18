import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { CRIMSON, INK, LIGHT, LINE, Mark, MUTED } from "./shared";
import type { Prisma } from "@/generated/prisma/client";
import type { getOrgSettings } from "@/lib/queries/org";
import { amountInWords } from "@/lib/amount-in-words";
import { PAYMENT_METHOD_LABELS } from "@/lib/crm-meta";
import { formatDate, formatMoney, fullName } from "@/lib/utils";

type Org = Awaited<ReturnType<typeof getOrgSettings>>;

export const receiptInclude = {
  recordedBy: { select: { name: true } },
  invoice: {
    select: {
      id: true,
      number: true,
      title: true,
      currency: true,
      total: true,
      amountPaid: true,
      status: true,
      payments: { select: { amount: true, createdAt: true } },
      company: { select: { name: true, addressLine: true, city: true, country: true } },
      contact: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.PaymentInclude;
export type FullReceipt = Prisma.PaymentGetPayload<{ include: typeof receiptInclude }>;

const s = StyleSheet.create({
  page: { fontFamily: "Geist", fontSize: 10, color: INK, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, lineHeight: 1.45 },
  row: { flexDirection: "row" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 16, marginBottom: 22 },
  orgName: { fontSize: 13, fontWeight: 600 },
  small: { fontSize: 8.5, color: MUTED },
  title: { fontSize: 20, fontWeight: 600, textAlign: "right", lineHeight: 1.15 },
  number: { fontSize: 10, color: CRIMSON, textAlign: "right", marginTop: 6, fontWeight: 500 },
  label: { fontSize: 7.5, fontWeight: 600, color: LIGHT, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  amountBox: { borderWidth: 1, borderColor: INK, borderRadius: 4, paddingVertical: 12, paddingHorizontal: 14, marginVertical: 16 },
  line: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 6 },
  lineLabel: { width: 150, color: MUTED },
  signLine: { borderBottomWidth: 0.75, borderBottomColor: MUTED, height: 34, marginBottom: 4 },
  footerLine: { position: "absolute", bottom: 38, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: LINE },
  footerLeft: { position: "absolute", bottom: 24, left: 44, fontSize: 7.5, color: LIGHT },
});

function ReceiptPdf({ p, org }: { p: FullReceipt; org: Org }) {
  const inv = p.invoice;
  const money = (v: { toString(): string } | number) => formatMoney(v, inv.currency);
  // Balance as it stood right after this payment, so an old receipt never changes.
  const paidSoFar = inv.payments.filter((x) => x.createdAt <= p.createdAt).reduce((sum, x) => sum + Number(x.amount), 0);
  const balance = Math.max(Math.round((Number(inv.total) - paidSoFar) * 100) / 100, 0);
  const from = inv.company?.name ?? (inv.contact ? fullName(inv.contact) : "—");
  const orgLine = [org.phone, org.email, org.website?.replace(/^https?:\/\//, "")].filter(Boolean).join("  ·  ");
  const idLine = [org.registrationNo && `BR ${org.registrationNo}`, org.vatNumber && `TIN/VAT ${org.vatNumber}`].filter(Boolean).join("  ·  ");

  return (
    <Document title={`${p.receiptNumber} ${from}`} author={org.companyName} subject="Payment receipt" creator="Softro CRM">
      <Page size="A4" style={s.page}>
        <View style={s.footerLine} fixed />
        <Text style={s.footerLeft} fixed>
          {org.companyName} · {p.receiptNumber}
        </Text>
        <View style={s.header}>
          <View style={[s.row, { gap: 10, maxWidth: 300 }]}>
            <Mark />
            <View>
              <Text style={s.orgName}>{org.companyName}</Text>
              {org.address ? <Text style={s.small}>{org.address}</Text> : null}
              {orgLine ? <Text style={s.small}>{orgLine}</Text> : null}
              {idLine ? <Text style={s.small}>{idLine}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={s.title}>Payment receipt</Text>
            <Text style={s.number}>{p.receiptNumber}</Text>
            <Text style={[s.small, { textAlign: "right", marginTop: 4 }]}>Date: {formatDate(p.paidAt)}</Text>
          </View>
        </View>

        <Text style={s.label}>Received with thanks from</Text>
        <Text style={{ fontWeight: 600, fontSize: 11 }}>{from}</Text>
        {inv.company && (inv.company.addressLine || inv.company.city) ? (
          <Text style={s.small}>{[inv.company.addressLine, inv.company.city, inv.company.country].filter(Boolean).join(", ")}</Text>
        ) : null}

        <View style={s.amountBox}>
          <View style={[s.row, { justifyContent: "space-between", alignItems: "center" }]}>
            <Text style={s.label}>Amount received</Text>
            <Text style={{ fontSize: 16, fontWeight: 600 }}>{money(p.amount)}</Text>
          </View>
          <Text style={[s.small, { marginTop: 4 }]}>{amountInWords(Number(p.amount), inv.currency)}</Text>
        </View>

        <View style={s.line}>
          <Text style={s.lineLabel}>For</Text>
          <Text style={{ flex: 1 }}>
            Invoice {inv.number}: {inv.title}
          </Text>
        </View>
        <View style={s.line}>
          <Text style={s.lineLabel}>Paid by</Text>
          <Text style={{ flex: 1 }}>
            {PAYMENT_METHOD_LABELS[p.method]}
            {p.reference ? ` · Ref. ${p.reference}` : ""}
          </Text>
        </View>
        <View style={s.line}>
          <Text style={s.lineLabel}>Invoice total</Text>
          <Text style={{ flex: 1 }}>{money(inv.total)}</Text>
        </View>
        <View style={s.line}>
          <Text style={s.lineLabel}>Balance after this payment</Text>
          <Text style={{ flex: 1, fontWeight: 600 }}>{balance > 0 ? money(balance) : "Paid in full"}</Text>
        </View>
        {p.method === "CHEQUE" ? <Text style={[s.small, { marginTop: 8 }]}>Payments by cheque are subject to realisation.</Text> : null}

        <View style={[s.row, { justifyContent: "flex-end", marginTop: 44 }]} wrap={false}>
          <View style={{ width: 210 }}>
            <View style={s.signLine} />
            <Text style={s.small}>Received by{p.recordedBy ? `: ${p.recordedBy.name}` : ""}</Text>
            <Text style={s.small}>For {org.companyName}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function renderReceiptPdf(payment: FullReceipt, org: Org) {
  return renderToBuffer(<ReceiptPdf p={payment} org={org} />);
}
