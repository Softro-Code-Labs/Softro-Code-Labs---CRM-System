"use client";

import { useActionState, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Package, Plus, Trash2 } from "lucide-react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button, LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Card } from "@/components/ui/card";
import { initialFormState, type FormState } from "@/lib/form";
import { CURRENCY_OPTIONS, QUOTE_UNITS } from "@/lib/crm-meta";
import { quoteTotals } from "@/lib/quote-math";
import { cn, formatMoney } from "@/lib/utils";

export type EditorItem = {
  key: string;
  productId: string | null;
  title: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPercent: string;
};

export type EditorValues = {
  title: string;
  currency: string;
  issueDate: string;
  validUntil: string;
  dealId: string;
  companyId: string;
  contactId: string;
  introduction: string;
  terms: string;
  notes: string;
  discountPercent: string;
  taxLabel: string;
  taxRate: string;
};

type Option = { id: string; name: string };
type ProductOption = { id: string; name: string; description: string | null; unit: string; unitPrice: string; currency: string };

const num = (s: string) => {
  const n = Number(String(s).replace(/[,\s%]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
let keySeq = 0;
const newKey = () => `n${Date.now()}-${keySeq++}`;

const cellInput =
  "w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm focus:border-ink-700 focus:ring-2 focus:ring-ink-900/10 focus:outline-none";

export function QuoteEditor({
  action,
  initial,
  initialItems,
  products,
  companies,
  contacts,
  deals,
  cancelHref,
  isEdit,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: EditorValues;
  initialItems: EditorItem[];
  products: ProductOption[];
  companies: Option[];
  contacts: (Option & { companyId: string | null })[];
  deals: (Option & { companyId: string | null; contactId: string | null })[];
  cancelHref: string;
  isEdit?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = (k: keyof EditorValues) => state.values?.[k] ?? initial[k];
  const e = state.errors ?? {};

  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const [currency, setCurrency] = useState(initial.currency);
  const [dealId, setDealId] = useState(initial.dealId);
  const [companyId, setCompanyId] = useState(initial.companyId);
  const [contactId, setContactId] = useState(initial.contactId);
  const [discount, setDiscount] = useState(initial.discountPercent);
  const [taxRate, setTaxRate] = useState(initial.taxRate);
  const [taxLabel, setTaxLabel] = useState(initial.taxLabel);
  const [productPick, setProductPick] = useState("");

  const totals = useMemo(
    () => quoteTotals(items.map((i) => ({ quantity: num(i.quantity), unitPrice: num(i.unitPrice), discountPercent: num(i.discountPercent) })), num(discount), num(taxRate)),
    [items, discount, taxRate],
  );
  const money = (n: number) => formatMoney(n, currency);
  const hasLineDiscount = items.some((i) => num(i.discountPercent) > 0);

  const update = (key: string, patch: Partial<EditorItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const move = (index: number, dir: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + dir, 0, item);
      return next;
    });
  const addBlank = () => setItems((list) => [...list, { key: newKey(), productId: null, title: "", description: "", quantity: "1", unit: "project", unitPrice: "", discountPercent: "0" }]);
  const addProduct = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setItems((list) => [
      ...list.filter((i) => i.title || i.unitPrice), // replace an untouched blank line
      { key: newKey(), productId: p.id, title: p.name, description: p.description ?? "", quantity: "1", unit: p.unit, unitPrice: p.unitPrice, discountPercent: "0" },
    ]);
    setProductPick("");
  };

  const contactOptions = contacts.filter((c) => !companyId || !c.companyId || c.companyId === companyId).map((c) => ({ value: c.id, label: c.name }));
  const productsInOtherCurrency = products.some((p) => p.currency !== currency);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage message={state.message} />
      <input type="hidden" name="items" value={JSON.stringify(items.map((i) => ({ productId: i.productId, title: i.title, description: i.description, quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice, discountPercent: i.discountPercent })))} />

      <Card className="p-6">
        <div className="grid gap-5 sm:grid-cols-6">
          <TextField label="Quote title" name="title" required placeholder="Inventory & POS system" defaultValue={v("title")} error={e.title} className="sm:col-span-4" />
          <SelectField label="Currency" name="currency" options={CURRENCY_OPTIONS} value={currency} onChange={(ev) => setCurrency(ev.target.value)} error={e.currency} className="sm:col-span-2" />
          <SelectField
            label="Deal"
            name="dealId"
            options={deals.map((d) => ({ value: d.id, label: d.name }))}
            placeholder="Not linked to a deal"
            value={dealId}
            onChange={(ev) => {
              setDealId(ev.target.value);
              const deal = deals.find((d) => d.id === ev.target.value);
              if (deal?.companyId) setCompanyId(deal.companyId);
              if (deal?.contactId) setContactId(deal.contactId);
            }}
            error={e.dealId}
            className="sm:col-span-2"
          />
          <SelectField
            label="Client company"
            name="companyId"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="No company (individual)"
            value={companyId}
            onChange={(ev) => {
              setCompanyId(ev.target.value);
              const c = contacts.find((x) => x.id === contactId);
              if (c?.companyId && c.companyId !== ev.target.value) setContactId("");
            }}
            error={e.companyId}
            className="sm:col-span-2"
          />
          <SelectField label="Attention of" name="contactId" options={contactOptions} placeholder="No contact" value={contactId} onChange={(ev) => setContactId(ev.target.value)} error={e.contactId} className="sm:col-span-2" />
          <TextField label="Quote date" name="issueDate" type="date" required defaultValue={v("issueDate")} error={e.issueDate} className="sm:col-span-3" />
          <TextField label="Valid until" name="validUntil" type="date" defaultValue={v("validUntil")} error={e.validUntil} className="sm:col-span-3" />
          <TextAreaField label="Introduction (optional)" name="introduction" rows={2} placeholder="Thank you for the opportunity. Here's our proposal for…" defaultValue={v("introduction")} error={e.introduction} className="sm:col-span-6" />
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-ink-900">Line items</h2>
          <div className="flex flex-wrap items-center gap-2">
            {products.length > 0 && (
              <label className="flex items-center gap-2">
                <Package className="size-4 text-ink-400" aria-hidden />
                <span className="sr-only">Add from catalogue</span>
                <select
                  value={productPick}
                  onChange={(ev) => addProduct(ev.target.value)}
                  className="h-8 max-w-64 rounded-lg border border-ink-300 bg-white px-2 text-sm focus:border-ink-700 focus:outline-none"
                >
                  <option value="">Add from catalogue…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {formatMoney(p.unitPrice, p.currency)}/{p.unit}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button type="button" size="sm" variant="secondary" onClick={addBlank}>
              <Plus className="size-4" aria-hidden /> Add line
            </Button>
          </div>
        </div>
        {productsInOtherCurrency && (
          <p className="border-b border-ink-100 bg-amber-50/60 px-5 py-2 text-xs text-amber-800">
            Some catalogue prices are in another currency. Check prices after adding them; they aren&apos;t converted.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs font-medium text-ink-500">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2">Item</th>
                <th className="w-20 px-2 py-2 text-right">Qty</th>
                <th className="w-28 px-2 py-2">Per</th>
                <th className="w-36 px-2 py-2 text-right">Price ({currency})</th>
                <th className="w-20 px-2 py-2 text-right">Disc. %</th>
                <th className="w-32 px-2 py-2 text-right">Amount</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 align-top">
              {items.map((item, i) => (
                <tr key={item.key}>
                  <td className="px-2 py-2">
                    <div className="flex flex-col">
                      <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move line up" className="text-ink-300 hover:text-ink-800 disabled:opacity-30">
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move line down" className="text-ink-300 hover:text-ink-800 disabled:opacity-30">
                        <ArrowDown className="size-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="min-w-64 px-2 py-2">
                    <input aria-label="Item name" value={item.title} onChange={(ev) => update(item.key, { title: ev.target.value })} placeholder="What you'll deliver" className={cn(cellInput, "font-medium")} />
                    <textarea
                      aria-label="Item description"
                      value={item.description}
                      onChange={(ev) => update(item.key, { description: ev.target.value })}
                      placeholder="Details (optional)"
                      rows={2}
                      className={cn(cellInput, "mt-1 text-xs text-ink-600")}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input aria-label="Quantity" inputMode="decimal" value={item.quantity} onChange={(ev) => update(item.key, { quantity: ev.target.value })} className={cn(cellInput, "text-right")} />
                  </td>
                  <td className="px-2 py-2">
                    <input aria-label="Unit" list="quote-unit-list" value={item.unit} onChange={(ev) => update(item.key, { unit: ev.target.value })} className={cellInput} />
                  </td>
                  <td className="px-2 py-2">
                    <input aria-label="Unit price" inputMode="decimal" value={item.unitPrice} onChange={(ev) => update(item.key, { unitPrice: ev.target.value })} placeholder="0" className={cn(cellInput, "text-right")} />
                  </td>
                  <td className="px-2 py-2">
                    <input aria-label="Line discount percent" inputMode="decimal" value={item.discountPercent} onChange={(ev) => update(item.key, { discountPercent: ev.target.value })} className={cn(cellInput, "text-right")} />
                  </td>
                  <td className="px-2 py-3.5 text-right font-medium whitespace-nowrap text-ink-900 tabular-nums">{money(totals.lineTotals[i] ?? 0)}</td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => setItems((list) => list.filter((x) => x.key !== item.key))} aria-label="Remove line" className="rounded p-1.5 text-ink-300 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-ink-500">
                    No lines yet. Add one from your catalogue or click <strong>Add line</strong>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <datalist id="quote-unit-list">
            {QUOTE_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-col gap-6 border-t border-ink-100 px-5 py-5 sm:flex-row sm:justify-between">
          <div className="grid max-w-md grid-cols-3 gap-3">
            <TextField label="Discount %" name="discountPercent" inputMode="decimal" value={discount} onChange={(ev) => setDiscount(ev.target.value)} error={e.discountPercent} />
            <TextField label="Tax label" name="taxLabel" value={taxLabel} onChange={(ev) => setTaxLabel(ev.target.value)} error={e.taxLabel} />
            <TextField label="Tax %" name="taxRate" inputMode="decimal" value={taxRate} onChange={(ev) => setTaxRate(ev.target.value)} error={e.taxRate} />
          </div>
          <dl className="min-w-64 space-y-1.5 text-sm">
            <div className="flex justify-between gap-6">
              <dt className="text-ink-500">Subtotal{hasLineDiscount && " (after line discounts)"}</dt>
              <dd className="tabular-nums">{money(totals.subtotal)}</dd>
            </div>
            {totals.discountTotal > 0 && (
              <div className="flex justify-between gap-6">
                <dt className="text-ink-500">Discount ({num(discount)}%)</dt>
                <dd className="tabular-nums">−{money(totals.discountTotal)}</dd>
              </div>
            )}
            {num(taxRate) > 0 && (
              <div className="flex justify-between gap-6">
                <dt className="text-ink-500">
                  {taxLabel || "Tax"} ({num(taxRate)}%)
                </dt>
                <dd className="tabular-nums">{money(totals.taxTotal)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-6 border-t border-ink-200 pt-2 text-base font-semibold text-ink-900">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(totals.total)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card className="p-6">
        <div className="grid gap-5">
          <TextAreaField label="Terms" name="terms" rows={6} hint="Payment schedule, timeline, what's included, revisions, warranty. Printed on the quote." defaultValue={v("terms")} error={e.terms} />
          <TextAreaField label="Internal notes" name="notes" rows={2} hint="Only visible in the CRM. Never printed." defaultValue={v("notes")} error={e.notes} />
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <LinkButton href={cancelHref} variant="secondary">
          Cancel
        </LinkButton>
        <SubmitButton>{isEdit ? "Save quote" : "Create quote"}</SubmitButton>
      </div>
    </form>
  );
}
