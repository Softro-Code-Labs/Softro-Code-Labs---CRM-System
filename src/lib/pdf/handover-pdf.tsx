import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { getOrgSettings } from "@/lib/queries/org";
import type { HandoverSnapshot } from "@/lib/project-access";
import { formatDate } from "@/lib/utils";
import { ACCOUNT_OWNER_LABELS, SERVICE_CATEGORY_LABELS, SIGN_IN_LABELS, TWO_STEP_LABELS } from "@/lib/crm-meta";
import { CRIMSON, INK, LIGHT, LINE, Mark, MUTED } from "./shared";

type Org = Awaited<ReturnType<typeof getOrgSettings>>;

const s = StyleSheet.create({
  page: { fontFamily: "Geist", fontSize: 9.5, color: INK, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, lineHeight: 1.4 },
  row: { flexDirection: "row" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 16, marginBottom: 18 },
  orgName: { fontSize: 13, fontWeight: 600 },
  small: { fontSize: 8.5, color: MUTED },
  title: { fontSize: 20, fontWeight: 600, textAlign: "right", lineHeight: 1.15 },
  number: { fontSize: 10, color: CRIMSON, textAlign: "right", marginTop: 6, fontWeight: 500 },
  label: { fontSize: 7.5, fontWeight: 600, color: LIGHT, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  h2: { fontSize: 11.5, fontWeight: 600, marginTop: 18, marginBottom: 6 },
  p: { fontSize: 9, color: "#3a3734" },
  th: { fontSize: 7.5, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: INK, paddingBottom: 5 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 6 },
  note: { marginTop: 16, borderLeftWidth: 2.5, borderLeftColor: CRIMSON, backgroundColor: "#fbf6f2", paddingVertical: 8, paddingHorizontal: 10 },
  sign: { flexDirection: "row", gap: 30, marginTop: 34 },
  signBox: { flex: 1, borderTopWidth: 0.75, borderTopColor: INK, paddingTop: 5 },
  footerLine: { position: "absolute", bottom: 38, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: LINE },
  footerLeft: { position: "absolute", bottom: 24, left: 44, fontSize: 7.5, color: LIGHT },
  footerRight: { position: "absolute", bottom: 24, left: 320, right: 44, fontSize: 7.5, color: LIGHT, textAlign: "right" },
});

const COLS = { service: { flex: 1.25, paddingRight: 8 }, login: { flex: 1.35, paddingRight: 8 }, owner: { width: 52 }, renews: { width: 66, textAlign: "right" as const } };

function HandoverPdf({ h, org }: { h: HandoverSnapshot; org: Org }) {
  const orgLine = [org.phone, org.email, org.website?.replace(/^https?:\/\//, "")].filter(Boolean).join("  ·  ");
  const renewals = h.services.filter((x) => x.renewsAt).sort((a, b) => a.renewsAt!.localeCompare(b.renewsAt!));

  return (
    <Document title={`${h.number} Project Delivery Pack: ${h.project.title}`} author={org.companyName} subject="Project Delivery Pack" creator="Softro CRM">
      <Page size="A4" style={s.page}>
        <View style={s.footerLine} fixed />
        <Text style={s.footerLeft} fixed>
          {org.companyName} · Project Delivery Pack
        </Text>
        <Text style={s.footerRight} fixed>
          {h.number}
        </Text>

        <View style={s.header}>
          <View style={[s.row, { gap: 10, flex: 1, paddingRight: 20 }]}>
            <Mark />
            <View style={{ flex: 1 }}>
              <Text style={s.orgName}>{org.companyName}</Text>
              {org.address ? <Text style={s.small}>{org.address}</Text> : null}
              {orgLine ? <Text style={s.small}>{orgLine}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={s.title}>Project Delivery Pack</Text>
            <Text style={s.number}>{h.number}</Text>
            <Text style={[s.small, { textAlign: "right", marginTop: 4 }]}>
              {(h.version ?? 1) > 1 ? `Version ${h.version} · updated ${formatDate(h.issuedAt)}` : `Date: ${formatDate(h.issuedAt)}`}
            </Text>
          </View>
        </View>

        <View style={[s.row, { justifyContent: "space-between" }]}>
          <View style={{ maxWidth: 260 }}>
            <Text style={s.label}>Prepared for</Text>
            <Text style={{ fontWeight: 600 }}>{h.project.client ?? h.project.contact ?? "—"}</Text>
            {h.project.client && h.project.contact ? <Text style={s.small}>Contact: {h.project.contact}</Text> : null}
          </View>
          <View style={{ maxWidth: 240, alignItems: "flex-end" }}>
            <Text style={s.label}>Project</Text>
            <Text style={{ fontWeight: 600, textAlign: "right" }}>{h.project.title}</Text>
            {h.issuedBy ? <Text style={s.small}>Prepared by {h.issuedBy}</Text> : null}
          </View>
        </View>

        <Text style={s.p}>
          {"\n"}This document lists the accounts and services used for your project, who owns each one, and what needs renewing. Keep it with your
          company records.
        </Text>

        {h.account ? (
          <>
            <Text style={s.h2}>Project account</Text>
            <Text style={s.p}>
              The services below were set up with <Text style={{ fontWeight: 600, color: INK }}>{h.account.email}</Text>. Its 2-step verification
              uses: {TWO_STEP_LABELS[h.account.twoStep].toLowerCase()}.
            </Text>
          </>
        ) : null}

        <Text style={s.h2}>Services and accounts</Text>
        {h.services.length ? (
          <View>
            <View style={s.tableHead}>
              <Text style={[s.th, COLS.service]}>Service</Text>
              <Text style={[s.th, COLS.login]}>Login</Text>
              <Text style={[s.th, COLS.owner]}>Owner</Text>
              <Text style={[s.th, COLS.renews]}>Renews</Text>
            </View>
            {h.services.map((x, i) => (
              <View key={i} style={s.tr} wrap={false}>
                <View style={COLS.service}>
                  <Text style={{ fontWeight: 500 }}>{x.name}</Text>
                  <Text style={s.small}>{SERVICE_CATEGORY_LABELS[x.category]}</Text>
                  {x.url ? <Text style={[s.small, { color: CRIMSON }]}>{x.url.replace(/^https?:\/\//, "")}</Text> : null}
                </View>
                <View style={COLS.login}>
                  <Text>{x.loginEmail ?? "—"}</Text>
                  <Text style={s.small}>{SIGN_IN_LABELS[x.signIn]}</Text>
                </View>
                <Text style={COLS.owner}>{ACCOUNT_OWNER_LABELS[x.owner]}</Text>
                <Text style={COLS.renews}>{x.renewsAt ? formatDate(x.renewsAt) : "—"}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.p}>No separate services.</Text>
        )}

        {renewals.length ? (
          <View wrap={false}>
            <Text style={s.h2}>Renewals to plan for</Text>
            {renewals.map((x, i) => (
              <Text key={i} style={s.p}>
                • {formatDate(x.renewsAt)}: {x.name}
                {x.owner === "CLIENT" ? " (you renew this)" : x.owner === "SOFTRO" ? " (Softro renews this)" : " (shared)"}
              </Text>
            ))}
          </View>
        ) : null}

        {h.settingsLocation ? (
          <View wrap={false}>
            <Text style={s.h2}>Settings</Text>
            <Text style={s.p}>{`The website's settings (API keys and similar) are kept in: ${h.settingsLocation}. They are not printed here.`}</Text>
          </View>
        ) : null}

        <View wrap={false}>
          <Text style={s.h2}>Support</Text>
          {h.support.length ? (
            h.support.map((c, i) => (
              <Text key={i} style={s.p}>
                • {c.number} {c.title}
                {c.responseTimeHours ? `: first reply within ${c.responseTimeHours} hours` : ""}
                {c.endDate ? `, until ${formatDate(c.endDate)}` : ""}
              </Text>
            ))
          ) : (
            <Text style={s.p}>Contact us for maintenance or changes. We keep a record of your project, so we can pick it up quickly.</Text>
          )}
          <Text style={[s.p, { marginTop: 4 }]}>{[org.phone, org.email].filter(Boolean).join("  ·  ")}</Text>
        </View>

        <View style={s.note} wrap={false}>
          <Text style={{ fontWeight: 600, fontSize: 9 }}>Passwords are not in this document</Text>
          <Text style={[s.p, { marginTop: 2 }]}>
            For your security, passwords are in a separate login sheet, a PDF locked with its own password that we give you separately (by phone
            or WhatsApp). Please change each password after you take over the account, and keep them in your password manager.
          </Text>
        </View>

        <View style={s.sign} wrap={false}>
          <View style={s.signBox}>
            <Text style={s.small}>Delivered by: {org.companyName}</Text>
            <Text style={[s.small, { marginTop: 14 }]}>Name, signature, date</Text>
          </View>
          <View style={s.signBox}>
            <Text style={s.small}>Received by: {h.project.client ?? "Client"}</Text>
            <Text style={[s.small, { marginTop: 14 }]}>Name, signature, date</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function renderHandoverPdf(h: HandoverSnapshot, org: Org) {
  return renderToBuffer(<HandoverPdf h={h} org={org} />);
}
