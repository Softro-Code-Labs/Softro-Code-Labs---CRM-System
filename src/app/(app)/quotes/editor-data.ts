import "server-only";
import { db } from "@/lib/db";
import { getCompanyOptions } from "@/lib/queries/companies";
import { getContactOptions } from "@/lib/queries/contacts";
import type { EditorItem } from "./quote-editor";
import type { FullQuote } from "@/lib/quotes";

export async function getEditorOptions() {
  const [products, companies, contacts, deals] = await Promise.all([
    db.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    getCompanyOptions(),
    getContactOptions(),
    db.deal.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 500,
      select: { id: true, title: true, status: true, companyId: true, contactId: true, company: { select: { name: true } } },
    }),
  ]);
  return {
    products: products.map((p) => ({ id: p.id, name: p.name, description: p.description, unit: p.unit, unitPrice: p.unitPrice.toString(), currency: p.currency })),
    companies,
    contacts,
    deals: deals.map((d) => ({
      id: d.id,
      name: `${d.title}${d.company ? ` · ${d.company.name}` : ""}${d.status !== "OPEN" ? ` (${d.status.toLowerCase()})` : ""}`,
      companyId: d.companyId,
      contactId: d.contactId,
    })),
  };
}

export function itemsForEditor(quote: FullQuote): EditorItem[] {
  return quote.items.map((i) => ({
    key: i.id,
    productId: i.productId,
    title: i.title,
    description: i.description ?? "",
    quantity: i.quantity.toString(),
    unit: i.unit,
    unitPrice: i.unitPrice.toString(),
    discountPercent: i.discountPercent.toString(),
  }));
}

