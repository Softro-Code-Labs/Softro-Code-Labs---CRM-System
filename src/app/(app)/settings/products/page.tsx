import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";
import { SERVICE_TYPE_SHORT } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditProductRow, NewProductForm } from "./product-form";

export const metadata: Metadata = { title: "Services & prices" };

export default async function ProductsPage() {
  await requirePermission("product:manage");
  const products = await db.product.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Services & prices"
        description="Your standard services with prices. Add them to a quote in one click, then adjust the price for that client if needed."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Services & prices" }]}
      />
      <Card>
        <CardHeader title="Add a service" />
        <CardBody>
          <NewProductForm defaultCurrency={process.env.DEFAULT_CURRENCY ?? "LKR"} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={`Catalogue (${products.filter((p) => p.isActive).length})`} />
        {products.length === 0 ? (
          <CardBody className="text-sm text-ink-500">No services yet. Add the things you quote most often, e.g. a 5-page website or monthly hosting and support.</CardBody>
        ) : (
          <ul className="divide-y divide-ink-100">
            {products.map((p) => (
              <li key={p.id} className={p.isActive ? "px-5 py-4" : "bg-ink-50/60 px-5 py-4 opacity-70"}>
                <EditProductRow
                  id={p.id}
                  isActive={p.isActive}
                  initial={{
                    name: p.name,
                    description: p.description ?? "",
                    unit: p.unit,
                    unitPrice: p.unitPrice.toString(),
                    currency: p.currency,
                    serviceType: p.serviceType ?? "",
                  }}
                  summary={
                    <>
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
                        {p.name}
                        {p.serviceType && <Badge tone="gray">{SERVICE_TYPE_SHORT[p.serviceType]}</Badge>}
                        {!p.isActive && <Badge tone="gray">Archived</Badge>}
                      </p>
                      <p className="text-sm text-ink-700">
                        {formatMoney(p.unitPrice, p.currency)} <span className="text-ink-500">per {p.unit}</span>
                      </p>
                      {p.description && <p className="mt-1 text-xs whitespace-pre-line text-ink-500">{p.description}</p>}
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
