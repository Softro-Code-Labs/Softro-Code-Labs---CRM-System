import path from "node:path";
import { Document, Font, Page, Path, Defs, LinearGradient, Stop, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { FullQuote } from "@/lib/quotes";
import type { getOrgSettings } from "@/lib/queries/org";
import { formatDate, formatMoney, fullName } from "@/lib/utils";
import { formatQuantity } from "@/lib/quote-math";

type Org = Awaited<ReturnType<typeof getOrgSettings>>;

// Geist, the same typeface as the CRM and softrocodelabs.com (SIL Open Font License).
const fontDir = path.join(process.cwd(), "src", "assets", "fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(fontDir, "Geist-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "Geist-Medium.ttf"), fontWeight: 500 },
    { src: path.join(fontDir, "Geist-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(fontDir, "Geist-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]); // don't break words with hyphens

const INK = "#161517";
const MUTED = "#6e6962";
const LIGHT = "#8f8a82";
const LINE = "#e2ddd4";
const CRIMSON = "#a70b21";

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
  footerLine: { position: "absolute", bottom: 38, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: LINE },
  footerLeft: { position: "absolute", bottom: 24, left: 44, fontSize: 7.5, color: LIGHT },
  footerRight: { position: "absolute", bottom: 24, left: 320, right: 44, fontSize: 7.5, color: LIGHT, textAlign: "right" },
});

function Mark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="10 15.5 170 170">
      <Defs>
        <LinearGradient id="g" x1="0" y1="40" x2="0" y2="170" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#A70B21" />
          <Stop offset="1" stopColor="#EF4C5B" />
        </LinearGradient>
      </Defs>
      <Path
        fill="url(#g)"
        fillRule="evenodd"
        d="M111.5 24 L47 54.5 L47 102 L98.5 121.5 L98.5 154 L83 146 L83 121.4 L69 116.3 L69 154.6 L112.6 177 L112.6 78 L98.3 83.2 L98.3 105.9 L83 100.4 L83 83.4 L129 66.4 L129 117 L117 113 L117 127.5 L143.3 137 L143.3 46.8 L112.6 57 L112.6 24 Z M98.3 45.4 L98.3 62.4 L69 73.2 L69 95.2 L61.2 92.8 L61.2 63.5 Z"
      />
    </Svg>
  );
}

function QuotePdf({ quote, org }: { quote: FullQuote; org: Org }) {
  const money = (v: { toString(): string }) => formatMoney(v, quote.currency);
  const anyDisc = quote.items.some((i) => Number(i.discountPercent) > 0);
  const client = quote.company;
  const contact = quote.contact;
  const orgLine = [org.phone, org.email, org.website?.replace(/^https?:\/\//, "")].filter(Boolean).join("  ·  ");
  const idLine = [org.registrationNo && `BR ${org.registrationNo}`, org.vatNumber && `TIN/VAT ${org.vatNumber}`].filter(Boolean).join("  ·  ");

  return (
    <Document title={`${quote.number} ${quote.title}`} author={org.companyName} subject="Quotation" creator="Softro CRM">
      <Page size="A4" style={s.page}>
        <View style={s.footerLine} fixed />
        <Text style={s.footerLeft} fixed>
          {org.quoteFooter || org.companyName}
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
            <Text style={s.title}>Quotation</Text>
            <Text style={s.number}>{quote.number}</Text>
            <Text style={[s.small, { textAlign: "right", marginTop: 4 }]}>Date: {formatDate(quote.issueDate)}</Text>
            {quote.validUntil ? <Text style={[s.small, { textAlign: "right" }]}>Valid until: {formatDate(quote.validUntil)}</Text> : null}
          </View>
        </View>

        <View style={[s.row, { justifyContent: "space-between", marginBottom: 14 }]}>
          <View style={{ maxWidth: 260 }}>
            <Text style={s.label}>Prepared for</Text>
            {client ? <Text style={{ fontWeight: 600 }}>{client.name}</Text> : null}
            {contact ? (
              <Text>
                Attn: {fullName(contact)}
                {contact.jobTitle ? `, ${contact.jobTitle}` : ""}
              </Text>
            ) : null}
            {client && (client.addressLine || client.city) ? <Text style={s.small}>{[client.addressLine, client.city, client.country].filter(Boolean).join(", ")}</Text> : null}
            {contact?.email || client?.email ? <Text style={s.small}>{contact?.email ?? client?.email}</Text> : null}
          </View>
          <View style={{ maxWidth: 230, alignItems: "flex-end" }}>
            <Text style={s.label}>Project</Text>
            <Text style={{ fontWeight: 600, textAlign: "right" }}>{quote.title}</Text>
            {quote.createdBy ? <Text style={[s.small, { textAlign: "right" }]}>Your contact: {quote.createdBy.name}</Text> : null}
          </View>
        </View>

        {quote.introduction ? <Text style={{ marginBottom: 12 }}>{quote.introduction}</Text> : null}

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
        </View>

        {quote.terms || org.bankDetails ? (
          <View style={[s.row, { gap: 20, marginTop: 24, borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 12 }]} wrap={false}>
            {quote.terms ? (
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Terms</Text>
                <Text style={{ fontSize: 8.5, color: MUTED }}>{quote.terms}</Text>
              </View>
            ) : null}
            {org.bankDetails ? (
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Payment details</Text>
                <Text style={{ fontSize: 8.5, color: MUTED }}>{org.bankDetails}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

      </Page>
    </Document>
  );
}

export function renderQuotePdf(quote: FullQuote, org: Org) {
  return renderToBuffer(<QuotePdf quote={quote} org={org} />);
}
