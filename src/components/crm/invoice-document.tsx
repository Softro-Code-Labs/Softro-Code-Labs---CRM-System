import type { FullInvoice } from "@/lib/invoices";
import { balanceDue } from "@/lib/invoices";
import { amountInWords } from "@/lib/amount-in-words";
import type { getOrgSettings } from "@/lib/queries/org";
import { formatDate, formatMoney, fullName } from "@/lib/utils";
import { formatQuantity } from "@/lib/quote-math";
import { SoftroMark } from "@/components/brand/logo";

type Org = Awaited<ReturnType<typeof getOrgSettings>>;

/** On-screen preview of an invoice; matches the PDF layout. "Tax Invoice" when Softro has a VAT number. */
export function InvoiceDocument({ invoice: quote, org }: { invoice: FullInvoice; org: Org }) {
  const balance = balanceDue(quote);
  const paid = Number(quote.amountPaid);
  const money = (v: { toString(): string }) => formatMoney(v, quote.currency);
  const anyLineDiscount = quote.items.some((i) => Number(i.discountPercent) > 0);
  const client = quote.company;
  const contact = quote.contact;

  return (
    // Paper-like preview of the PDF: stays white in dark mode, like the real document.
    <article className="theme-fixed rounded-xl border border-ink-200 bg-white px-8 py-10 text-ink-900 shadow-sm sm:px-12">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-ink-100 pb-6">
        <div className="flex items-start gap-3">
          <SoftroMark size={44} />
          <div className="text-xs leading-relaxed text-ink-500">
            <p className="text-base font-semibold text-ink-900">{org.companyName}</p>
            {org.address && <p className="whitespace-pre-line">{org.address}</p>}
            <p>{[org.phone, org.email, org.website?.replace(/^https?:\/\//, "")].filter(Boolean).join(" · ")}</p>
            {(org.registrationNo || org.vatNumber) && (
              <p>{[org.registrationNo && `BR ${org.registrationNo}`, org.vatNumber && `TIN/VAT ${org.vatNumber}`].filter(Boolean).join(" · ")}</p>
            )}
          </div>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-semibold tracking-tight text-ink-900">{org.vatNumber ? "Tax Invoice" : "Invoice"}</p>
          <p className="mt-1 font-mono text-sm text-brand-700">{quote.number}</p>
          <dl className="mt-2 text-xs text-ink-500">
            <div>
              <dt className="inline">Date: </dt>
              <dd className="inline text-ink-800">{formatDate(quote.issueDate)}</dd>
            </div>
            {quote.dueDate && (
              <div>
                <dt className="inline">Payment due: </dt>
                <dd className="inline text-ink-800">{formatDate(quote.dueDate)}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      <section className="grid gap-6 py-6 sm:grid-cols-2">
        <div className="text-sm">
          <p className="mb-1 text-xs font-semibold tracking-wide text-ink-400 uppercase">Bill to</p>
          {client && <p className="font-semibold text-ink-900">{client.name}</p>}
          {contact && (
            <p className="text-ink-700">
              Attn: {fullName(contact)}
              {contact.jobTitle && `, ${contact.jobTitle}`}
            </p>
          )}
          {client && (client.addressLine || client.city) && <p className="text-ink-500">{[client.addressLine, client.city, client.country].filter(Boolean).join(", ")}</p>}
          {(contact?.email ?? client?.email) && <p className="text-ink-500">{contact?.email ?? client?.email}</p>}
          {client?.taxId && <p className="text-ink-500">VAT/TIN: {client.taxId}</p>}
        </div>
        <div className="text-sm sm:text-right">
          <p className="mb-1 text-xs font-semibold tracking-wide text-ink-400 uppercase">For</p>
          <p className="font-semibold text-ink-900">{quote.title}</p>
          {quote.quote && <p className="text-ink-500">Ref: quotation {quote.quote.number}</p>}
          {quote.contract && <p className="text-ink-500">Ref: {quote.contract.number}</p>}
        </div>
      </section>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-ink-900 text-left text-xs font-semibold tracking-wide text-ink-500 uppercase">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Description</th>
            <th className="py-2 pr-2 text-right">Qty</th>
            <th className="py-2 pr-2 text-right">Price</th>
            {anyLineDiscount && <th className="py-2 pr-2 text-right">Disc.</th>}
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 align-top">
          {quote.items.map((item, i) => (
            <tr key={item.id}>
              <td className="py-3 pr-2 text-ink-400">{i + 1}</td>
              <td className="py-3 pr-2">
                <p className="font-medium text-ink-900">{item.title}</p>
                {item.description && <p className="mt-0.5 text-xs whitespace-pre-line text-ink-500">{item.description}</p>}
              </td>
              <td className="py-3 pr-2 text-right whitespace-nowrap text-ink-700">
                {formatQuantity(item.quantity, item.unit)}
              </td>
              <td className="py-3 pr-2 text-right whitespace-nowrap text-ink-700 tabular-nums">{money(item.unitPrice)}</td>
              {anyLineDiscount && <td className="py-3 pr-2 text-right text-ink-700">{Number(item.discountPercent) ? `${Number(item.discountPercent)}%` : "—"}</td>}
              <td className="py-3 text-right font-medium whitespace-nowrap text-ink-900 tabular-nums">{money(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-4 ml-auto max-w-xs space-y-1.5 border-t border-ink-200 pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-500">Subtotal</dt>
          <dd className="tabular-nums">{money(quote.subtotal)}</dd>
        </div>
        {Number(quote.discountTotal) > 0 && (
          <div className="flex justify-between">
            <dt className="text-ink-500">Discount ({Number(quote.discountPercent)}%)</dt>
            <dd className="tabular-nums">−{money(quote.discountTotal)}</dd>
          </div>
        )}
        {Number(quote.taxRate) > 0 && (
          <div className="flex justify-between">
            <dt className="text-ink-500">
              {quote.taxLabel} ({Number(quote.taxRate)}%)
            </dt>
            <dd className="tabular-nums">{money(quote.taxTotal)}</dd>
          </div>
        )}
        <div className="flex justify-between rounded-lg bg-ink-900 px-3 py-2 text-base font-semibold text-white">
          <dt>Total</dt>
          <dd className="tabular-nums">{money(quote.total)}</dd>
        </div>
        {paid > 0 && (
          <>
            <div className="flex justify-between pt-1">
              <dt className="text-ink-500">Paid</dt>
              <dd className="tabular-nums">−{money(quote.amountPaid)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Balance due</dt>
              <dd className="tabular-nums">{money(balance)}</dd>
            </div>
          </>
        )}
      </dl>
      <p className="mt-3 text-right text-xs text-ink-500 italic">{amountInWords(Number(quote.total), quote.currency)}</p>

      {(quote.terms || org.bankDetails) && (
        <section className="mt-8 grid gap-6 border-t border-ink-100 pt-6 text-xs text-ink-600 sm:grid-cols-2">
          {quote.terms && (
            <div>
              <p className="mb-1 font-semibold tracking-wide text-ink-400 uppercase">Payment instructions</p>
              <p className="whitespace-pre-line">{quote.terms}</p>
            </div>
          )}
          {org.bankDetails && (
            <div>
              <p className="mb-1 font-semibold tracking-wide text-ink-400 uppercase">Payment details</p>
              <p className="whitespace-pre-line">{org.bankDetails}</p>
            </div>
          )}
        </section>
      )}
      <p className="mt-8 text-center text-xs text-ink-400">Thank you for your business.</p>
    </article>
  );
}
