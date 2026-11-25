import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { getOrgSettings } from "@/lib/queries/org";
import { DEFAULT_NDA, DEFAULT_WARRANTY, DOC_FIELDS } from "@/lib/delivery-docs";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DocumentsForm } from "./documents-form";

export const metadata: Metadata = { title: "Warranty & NDA" };

/** Admins edit the warranty and NDA that can be added to a project's Delivery Pack. */
export default async function DeliveryDocsPage() {
  await requirePermission("org:manage");
  const org = await getOrgSettings();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Warranty & NDA"
        description="Wording for the warranty and the non-disclosure agreement. When you make a Project Delivery Pack you can choose to add either or both."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Warranty & NDA" }]}
      />

      <Card>
        <CardHeader title="How to write it" description="Have a lawyer read both once before you use them with clients." />
        <CardBody className="grid gap-6 text-sm text-ink-600 md:grid-cols-2">
          <ul className="space-y-1">
            <li>A blank line starts a new paragraph.</li>
            <li>
              A line starting with <code className="rounded bg-ink-100 px-1">## </code> is a heading.
            </li>
            <li>
              A line starting with <code className="rounded bg-ink-100 px-1">- </code> is a bullet point.
            </li>
            <li>Changes apply to Delivery Packs made or updated after you save. Packs already given to clients keep their wording.</li>
          </ul>
          <dl className="space-y-1">
            {DOC_FIELDS.map((f) => (
              <div key={f.key} className="flex gap-2">
                <dt>
                  <code className="rounded bg-ink-100 px-1 text-ink-800">{`{${f.key}}`}</code>
                </dt>
                <dd>{f.meaning}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <DocumentsForm
        initial={{
          supportMonths: String(org.supportMonths),
          warrantyMonths: String(org.warrantyMonths),
          warrantyTerms: org.warrantyTerms ?? DEFAULT_WARRANTY,
          ndaTerms: org.ndaTerms ?? DEFAULT_NDA,
        }}
        defaults={{ warrantyTerms: DEFAULT_WARRANTY, ndaTerms: DEFAULT_NDA }}
      />
    </div>
  );
}
