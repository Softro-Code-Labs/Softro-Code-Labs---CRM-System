import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { CRIMSON, INK, LIGHT, LINE, Mark, MUTED } from "./shared";
import { balanceDue, type FullInvoice } from "@/lib/invoices";
import { amountInWords } from "@/lib/amount-in-words";
import type { getOrgSettings } from "@/lib/queries/org";
import { formatDate, formatMoney, fullName } from "@/lib/utils";
import { formatQuantity } from "@/lib/quote-math";

type Org = Awaited<ReturnType<typeof getOrgSettings>>;

const s = StyleSheet.create({
  page: { fontFamily: "Geist", fontSize: 9.5, color: INK, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, lineHeight: 1.4 },
  row: { flexDirection: "row" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 16, marginBottom: 16 },
  orgName: { fontSize: 13, fontWeight: 600 },
  small: { fontSize: 8.5, color: MUTED },
  title: { fontSize: 20, fontWeight: 600, textAlign: "right", lineHeight: 1.15 },
  number: { fontSize: 10, color: CRIMSON, textAlign: "right", marginTop: 6, fontWeight: 500 },
  label: { fontSize: 7.5, fontWeight: 600, color: LIGHT, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  th: { fontSize: 7.5, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: INK, paddingBottom: 5, marginTop: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 7 },
  colNo: { width: 18, color: LIGHT },
  colDesc: { flex: 1, paddingRight: 8 },
  colQty: { width: 62, textAlign: "right" },
  colPrice: { width: 78, textAlign: "right" },
  colDisc: { width: 36, textAlign: "right" },
  colAmt: { width: 82, textAlign: "right" },
  totals: { marginLeft: "auto", width: 230, marginTop: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  grand: { flexDirection: "row", justifyContent: "space-between", backgroundColor: INK, color: "#ffffff", paddingVertical: 7, paddingHorizontal: 9, borderRadius: 4, marginTop: 5, fontSize: 11.5, fontWeight: 600 },
  signLine: { borderBottomWidth: 0.75, borderBottomColor: MUTED, height: 34, marginBottom: 4 },
  footerLine: { position: "absolute", bottom: 38, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: LINE },
  footerLeft: { position: "absolute", bottom: 24, left: 44, fontSize: 7.5, color: LIGHT },
  footerRight: { position: "absolute", bottom: 24, left: 320, right: 44, fontSize: 7.5, color: LIGHT, textAlign: "right" },
});

function InvoicePdf({ invoice: quote, org }: { invoice: FullInvoice; org: Org }) {
  const docTitle = org.vatNumber ? "Tax Invoice" : "Invoice";
  const paid = Number(quote.amountPaid);
  const money = (v: { toString(): string }) => formatMoney(v, quote.currency);
  const anyDisc = quote.items.some((i) => Number(i.discountPercent) > 0);
  const client = quote.company;
  const contact = quote.contact;
  const orgLine = [org.phone, org.email, org.website?.replace(/^https?:\/\//, "")].filter(Boolean).join("  ·  ");
  const idLine = [org.registrationNo && `BR ${org.registrationNo}`, org.vatNumber && `TIN/VAT ${org.vatNumber}`].filter(Boolean).join("  ·  ");

  return (
    <Document title={`${quote.number} ${quote.title}`} author={org.companyName} subject={docTitle} creator="Softro CRM">
      <Page size="A4" style={s.page}>
        <View style={s.footerLine} fixed />
        <Text style={s.footerLeft} fixed>
          {[org.companyName, org.vatNumber && `TIN/VAT ${org.vatNumber}`].filter(Boolean).join(" · ")}
        </Text>
        <Text style={s.footerRight} fixed>
          {quote.number}
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
            <Text style={s.title}>{docTitle}</Text>
            <Text style={s.number}>{quote.number}</Text>
            <Text style={[s.small, { textAlign: "right", marginTop: 4 }]}>Date: {formatDate(quote.issueDate)}</Text>
            {quote.dueDate ? <Text style={[s.small, { textAlign: "right", color: INK, fontWeight: 500 }]}>Payment due: {formatDate(quote.dueDate)}</Text> : null}
          </View>
        </View>

        <View style={[s.row, { justifyContent: "space-between", marginBottom: 14 }]}>
          <View style={{ maxWidth: 260 }}>
            <Text style={s.label}>Bill to</Text>
            {client ? <Text style={{ fontWeight: 600 }}>{client.name}</Text> : null}
            {contact ? (
              <Text>
                Attn: {fullName(contact)}
                {contact.jobTitle ? `, ${contact.jobTitle}` : ""}
              </Text>
            ) : null}
            {client && (client.addressLine || client.city) ? <Text style={s.small}>{[client.addressLine, client.city, client.country].filter(Boolean).join(", ")}</Text> : null}
            {contact?.email || client?.email ? <Text style={s.small}>{contact?.email ?? client?.email}</Text> : null}
            {client?.taxId ? <Text style={s.small}>VAT/TIN: {client.taxId}</Text> : null}
          </View>
          <View style={{ maxWidth: 230, alignItems: "flex-end" }}>
            <Text style={s.label}>For</Text>
            <Text style={{ fontWeight: 600, textAlign: "right" }}>{quote.title}</Text>
            {quote.quote ? <Text style={[s.small, { textAlign: "right" }]}>Ref: quotation {quote.quote.number}</Text> : null}
            {quote.contract ? <Text style={[s.small, { textAlign: "right" }]}>Ref: {quote.contract.number}</Text> : null}
          </View>
        </View>

        <View>
          <View style={s.tableHead} fixed>
            <Text style={[s.th, s.colNo]}>#</Text>
            <Text style={[s.th, s.colDesc]}>Description</Text>
            <Text style={[s.th, s.colQty]}>Qty</Text>
            <Text style={[s.th, s.colPrice]}>Price</Text>
            {anyDisc ? <Text style={[s.th, s.colDisc]}>Disc.</Text> : null}
            <Text style={[s.th, s.colAmt]}>Amount</Text>
          </View>
          {quote.items.map((item, i) => (
            <View key={item.id} style={s.tr} wrap={false}>
              <Text style={s.colNo}>{i + 1}</Text>
              <View style={s.colDesc}>
                <Text style={{ fontWeight: 500 }}>{item.title}</Text>
                {item.description ? <Text style={[s.small, { marginTop: 1 }]}>{item.description}</Text> : null}
              </View>
              <Text style={s.colQty}>
                {formatQuantity(item.quantity, item.unit)}
              </Text>
              <Text style={s.colPrice}>{money(item.unitPrice)}</Text>
              {anyDisc ? <Text style={s.colDisc}>{Number(item.discountPercent) ? `${Number(item.discountPercent)}%` : "—"}</Text> : null}
              <Text style={[s.colAmt, { fontWeight: 500 }]}>{money(item.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <Text style={{ color: MUTED }}>Subtotal</Text>
            <Text>{money(quote.subtotal)}</Text>
          </View>
          {Number(quote.discountTotal) > 0 ? (
            <View style={s.totalRow}>
              <Text style={{ color: MUTED }}>Discount ({Number(quote.discountPercent)}%)</Text>
              <Text>−{money(quote.discountTotal)}</Text>
            </View>
          ) : null}
          {Number(quote.taxRate) > 0 ? (
            <View style={s.totalRow}>
              <Text style={{ color: MUTED }}>
                {quote.taxLabel} ({Number(quote.taxRate)}%)
              </Text>
              <Text>{money(quote.taxTotal)}</Text>
            </View>
          ) : null}
          <View style={s.grand}>
            <Text>Total</Text>
            <Text>{money(quote.total)}</Text>
          </View>
          {paid > 0 ? (
            <>
              <View style={[s.totalRow, { marginTop: 4 }]}>
                <Text style={{ color: MUTED }}>Paid</Text>
                <Text>−{money(quote.amountPaid)}</Text>
              </View>
              <View style={[s.totalRow, { fontWeight: 600 }]}>
                <Text>Balance due</Text>
                <Text>{money(balanceDue(quote))}</Text>
              </View>
            </>
          ) : null}
        </View>
        <Text style={[s.small, { textAlign: "right", marginTop: 6 }]}>{amountInWords(Number(quote.total), quote.currency)}</Text>

        <View style={{ marginTop: 22, borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 12 }} wrap={false}>
          {quote.terms ? (
            <View style={{ marginBottom: 10 }}>
              <Text style={s.label}>Payment instructions</Text>
              <Text style={{ fontSize: 8.5, color: MUTED }}>{quote.terms}</Text>
            </View>
          ) : null}
          {org.bankDetails ? (
            <View>
              <Text style={s.label}>Payment details</Text>
              <Text style={{ fontSize: 8.5, color: MUTED }}>{org.bankDetails}</Text>
            </View>
          ) : null}
        </View>

        <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-end", marginTop: 30 }]} wrap={false}>
          <Text style={s.small}>Thank you for your business.</Text>
          <View style={{ width: 200 }}>
            <View style={s.signLine} />
            <Text style={s.small}>Authorised signature, for {org.companyName}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function renderInvoicePdf(invoice: FullInvoice, org: Org) {
  return renderToBuffer(<InvoicePdf invoice={invoice} org={org} />);
}
