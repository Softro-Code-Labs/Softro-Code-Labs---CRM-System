import { randomBytes } from "node:crypto";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { PDFDocument } from "@cantoo/pdf-lib";
import type { getOrgSettings } from "@/lib/queries/org";
import { formatDate } from "@/lib/utils";
import { SIGN_IN_LABELS, TWO_STEP_LABELS } from "@/lib/crm-meta";
import type { SignInMethod, TwoStepMethod } from "@/generated/prisma/enums";
import { CRIMSON, INK, LIGHT, LINE, Mark, MUTED } from "./shared";

type Org = Awaited<ReturnType<typeof getOrgSettings>>;

/**
 * The login sheet: the passwords for a project's accounts, for the client.
 * Built in memory from what was typed in, returned locked with a PDF password, and never stored.
 */
export type LoginSheet = {
  project: string;
  client: string | null;
  issuedBy: string | null;
  account: {
    email: string;
    twoStep: TwoStepMethod;
    password: string | null;
    backupCodes: string | null;
  } | null;
  services: {
    name: string;
    url: string | null;
    loginEmail: string | null;
    signIn: SignInMethod;
    password: string | null;
  }[];
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Geist",
    fontSize: 9.5,
    color: INK,
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    lineHeight: 1.4,
  },
  row: { flexDirection: "row" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 16,
    marginBottom: 16,
  },
  orgName: { fontSize: 13, fontWeight: 600 },
  small: { fontSize: 8.5, color: MUTED },
  title: {
    fontSize: 20,
    fontWeight: 600,
    textAlign: "right",
    lineHeight: 1.15,
  },
  badge: {
    fontSize: 8,
    color: CRIMSON,
    textAlign: "right",
    marginTop: 6,
    fontWeight: 600,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  label: {
    fontSize: 7.5,
    fontWeight: 600,
    color: LIGHT,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  h2: { fontSize: 11.5, fontWeight: 600, marginTop: 16, marginBottom: 6 },
  p: { fontSize: 9, color: "#3a3734" },
  th: {
    fontSize: 7.5,
    fontWeight: 600,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
    paddingBottom: 5,
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 7,
  },
  secret: { fontFamily: "Courier", fontSize: 10, color: INK },
  codes: { fontFamily: "Courier", fontSize: 9.5, color: INK, lineHeight: 1.6 },
  note: {
    marginTop: 16,
    borderLeftWidth: 2.5,
    borderLeftColor: CRIMSON,
    backgroundColor: "#fbf6f2",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  footerLine: {
    position: "absolute",
    bottom: 38,
    left: 44,
    right: 44,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
  },
  footerLeft: {
    position: "absolute",
    bottom: 24,
    left: 44,
    fontSize: 7.5,
    color: LIGHT,
  },
});

const COLS = {
  service: { flex: 1.1, paddingRight: 8 },
  login: { flex: 1.3, paddingRight: 8 },
  secret: { flex: 1.4 },
};

function howToSignIn(
  x: LoginSheet["services"][number],
  projectEmail: string | null,
) {
  if (x.signIn === "GOOGLE")
    return `Continue with Google${projectEmail ? ` (${projectEmail})` : ""}`;
  if (x.signIn === "GITHUB")
    return "Continue with GitHub (see the GitHub account)";
  return null;
}

function LoginSheetPdf({
  sheet,
  org,
  now,
}: {
  sheet: LoginSheet;
  org: Org;
  now: Date;
}) {
  const projectEmail = sheet.account?.email ?? null;
  return (
    <Document
      title={`Login sheet: ${sheet.project}`}
      author={org.companyName}
      subject="Login sheet (confidential)"
      creator="Softro CRM"
    >
      <Page size="A4" style={s.page}>
        <View style={s.footerLine} fixed />
        <Text style={s.footerLeft} fixed>
          Confidential · {org.companyName} · Login sheet · {sheet.project}
        </Text>

        <View style={s.header}>
          <View style={[s.row, { gap: 10, maxWidth: 300 }]}>
            <Mark />
            <View>
              <Text style={s.orgName}>{org.companyName}</Text>
              {org.phone || org.email ? (
                <Text style={s.small}>
                  {[org.phone, org.email].filter(Boolean).join("  ·  ")}
                </Text>
              ) : null}
            </View>
          </View>
          <View>
            <Text style={s.title}>Login sheet</Text>
            <Text style={s.badge}>Confidential</Text>
            <Text style={[s.small, { textAlign: "right", marginTop: 4 }]}>
              Date: {formatDate(now)}
            </Text>
          </View>
        </View>

        <View style={[s.row, { justifyContent: "space-between" }]}>
          <View style={{ maxWidth: 260 }}>
            <Text style={s.label}>For</Text>
            <Text style={{ fontWeight: 600 }}>{sheet.client ?? "—"}</Text>
          </View>
          <View style={{ maxWidth: 260, alignItems: "flex-end" }}>
            <Text style={s.label}>Project</Text>
            <Text style={{ fontWeight: 600, textAlign: "right" }}>
              {sheet.project}
            </Text>
            {sheet.issuedBy ? (
              <Text style={s.small}>Prepared by {sheet.issuedBy}</Text>
            ) : null}
          </View>
        </View>

        {sheet.account ? (
          <View wrap={false}>
            <Text style={s.h2}>Project Google account</Text>
            <View style={s.tr}>
              <View style={COLS.service}>
                <Text style={{ fontWeight: 500 }}>Gmail</Text>
                <Text style={s.small}>
                  2-step: {TWO_STEP_LABELS[sheet.account.twoStep].toLowerCase()}
                </Text>
              </View>
              <Text style={COLS.login}>{sheet.account.email}</Text>
              <View style={COLS.secret}>
                {sheet.account.password ? (
                  <Text style={s.secret}>{sheet.account.password}</Text>
                ) : (
                  <Text style={s.small}>Given separately</Text>
                )}
              </View>
            </View>
            {sheet.account.backupCodes ? (
              <View style={{ marginTop: 8 }}>
                <Text style={s.label}>
                  2-step backup codes (each works once)
                </Text>
                <Text style={s.codes}>{sheet.account.backupCodes}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={s.h2}>Services</Text>
        <View style={s.tableHead}>
          <Text style={[s.th, COLS.service]}>Service</Text>
          <Text style={[s.th, COLS.login]}>Login</Text>
          <Text style={[s.th, COLS.secret]}>Password / how to sign in</Text>
        </View>
        {sheet.services.map((x, i) => {
          const via = howToSignIn(x, projectEmail);
          return (
            <View key={i} style={s.tr} wrap={false}>
              <View style={COLS.service}>
                <Text style={{ fontWeight: 500 }}>{x.name}</Text>
                {x.url ? (
                  <Text style={[s.small, { color: CRIMSON }]}>
                    {x.url.replace(/^https?:\/\//, "")}
                  </Text>
                ) : null}
              </View>
              <View style={COLS.login}>
                <Text>{x.loginEmail ?? projectEmail ?? "—"}</Text>
                <Text style={s.small}>{SIGN_IN_LABELS[x.signIn]}</Text>
              </View>
              <View style={COLS.secret}>
                {via ? (
                  <Text style={s.p}>{via}</Text>
                ) : x.password ? (
                  <Text style={s.secret}>{x.password}</Text>
                ) : (
                  <Text style={s.small}>Given separately</Text>
                )}
              </View>
            </View>
          );
        })}

        <View style={s.note} wrap={false}>
          <Text style={{ fontWeight: 600, fontSize: 9 }}>
            Keep this sheet safe
          </Text>
          <Text style={[s.p, { marginTop: 2 }]}>
            Anyone with this sheet can sign in to your accounts. Change each
            password after you take over the account, save them in your own
            password manager, then delete this file. {org.companyName} does not
            keep a copy of these passwords.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/** Renders the sheet and locks it with AES-256. Copying text is allowed, so the client can paste the passwords. */
export async function renderLoginSheetPdf(
  sheet: LoginSheet,
  org: Org,
  pdfPassword: string,
  now = new Date(),
) {
  const plain = await renderToBuffer(
    <LoginSheetPdf sheet={sheet} org={org} now={now} />,
  );
  const doc = await PDFDocument.load(plain);
  await doc.encrypt({
    userPassword: pdfPassword,
    ownerPassword: randomBytes(24).toString("base64url"),
    permissions: {
      printing: "highResolution",
      copying: true,
      modifying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false,
    },
  });
  return doc.save();
}
