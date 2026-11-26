# Database fixes (admins only)

Ready-made SQL for mistakes the CRM screens can't undo: renumbering a document, removing test invoices or receipts, and setting numbering back. **Try the screens first.** Most mistakes are fixed there:

| Mistake | Fix it in the CRM |
|---|---|
| Wrong amount or details on an unpaid invoice | Invoice → **Edit** |
| Invoice made by mistake | Invoice → **Void invoice** (and **Restore invoice** to undo) |
| Payment recorded by mistake | Invoice → Payments → **Cancel** (if it was the latest receipt, its number is reused). Its commission goes too; if that commission is marked paid, an admin first clicks **Undo** on the Commissions page |
| Quote with wrong prices | Quote → **New version**, or **Delete** if it's a draft |
| Wrong contact, deal or company | Its page → **Edit** or **Delete** |
| Sealed quote, invoice, receipt or delivery pack needs a change | An admin or manager clicks **Remove seal**, makes the change, then seals it again |
| Website lead taken by the wrong person | An admin opens the lead → **Edit** → changes the owner (or the person's manager reassigns it in their team) |
| Someone in the wrong team | Settings → Team members → the person → **Manager (team)** |

The scripts below delete test invoices, receipts and quotes. A company seal on any of them is removed with it automatically.

Use this file only when that isn't enough.

---

## Rules

1. **Never on real records that a client has.** Invoices and receipts that were really sent must stay, so the numbering has no gaps for the accountant and the tax office. Void and reissue instead. These scripts are for **test data** and **mistakes nobody outside Softro has seen**.
2. **Run in Neon:** Neon Console → *Softro CRM* → **SQL Editor** → choose the **production** branch (top of the editor) → paste → **Run**.
3. **Change only the values in the `SETTINGS` block** at the top of each script. Keep the quotes: `'Q-2026-0002'`.
4. **Every script is one transaction with safety checks.** If a check fails, you'll see an error like *"Nothing changed"*, and nothing has changed.
5. **Try it first without saving:** change the last line `COMMIT;` to `ROLLBACK;` and run. You see the results, then everything is undone. When it looks right, put `COMMIT;` back and run again.
6. **Undo after committing:** Neon Console → your branch → **Restore** → pick a time a minute before you ran it. (The free plan keeps about a day of history.)
7. **Tell the team** in chat what you changed, and download fresh PDFs of anything renumbered.

Numbering in the CRM uses counters, one per document type and year:

| Documents | Counter key | Example |
|---|---|---|
| Quotes | `quote-2026` | Q-2026-0001 |
| Invoices | `invoice-2026` | INV-2026-0001 |
| Receipts | `receipt-2026` | RCT-2026-0001 |
| Contracts | `contract-2026` | C-2026-0001 |
| Support tickets | `ticket-2026` | T-2026-0001 |
| Project Delivery Packs | `handover-2026` | DP-2026-0001 |

A counter holds the **last number used**. The next document gets that number + 1.

---

## 1. See where numbering stands

Read-only. Safe any time.

```sql
SELECT key, value AS last_number_used FROM "Counter" ORDER BY key;

SELECT 'quote' AS type, max(number) AS highest FROM "Quote"
UNION ALL SELECT 'invoice', max(number) FROM "Invoice"
UNION ALL SELECT 'receipt', max("receiptNumber") FROM "Payment"
UNION ALL SELECT 'contract', max(number) FROM "Contract"
UNION ALL SELECT 'ticket', max(number) FROM "Ticket"
UNION ALL SELECT 'delivery pack', max(number) FROM "Handover";
```

---

## 2. Set numbering back to the highest number in use

After deleting test documents, so the next one continues straight after the last real one (or starts at 0001 if none are left). Change `year` if needed.

```sql
BEGIN;

-- SETTINGS
CREATE TEMP TABLE settings ON COMMIT DROP AS SELECT '2026'::text AS year;

UPDATE "Counter" c SET value = x.highest
FROM (
  SELECT 'quote-'   || s.year AS key, COALESCE((SELECT max(split_part(number, '-', 3)::int) FROM "Quote"    WHERE number LIKE 'Q-'   || s.year || '-%'), 0) AS highest FROM settings s
  UNION ALL
  SELECT 'invoice-' || s.year, COALESCE((SELECT max(split_part(number, '-', 3)::int) FROM "Invoice"  WHERE number LIKE 'INV-' || s.year || '-%'), 0) FROM settings s
  UNION ALL
  SELECT 'receipt-' || s.year, COALESCE((SELECT max(split_part("receiptNumber", '-', 3)::int) FROM "Payment" WHERE "receiptNumber" LIKE 'RCT-' || s.year || '-%'), 0) FROM settings s
  UNION ALL
  SELECT 'contract-' || s.year, COALESCE((SELECT max(split_part(number, '-', 3)::int) FROM "Contract" WHERE number LIKE 'C-'   || s.year || '-%'), 0) FROM settings s
  UNION ALL
  SELECT 'ticket-'  || s.year, COALESCE((SELECT max(split_part(number, '-', 3)::int) FROM "Ticket"   WHERE number LIKE 'T-'   || s.year || '-%'), 0) FROM settings s
  UNION ALL
  SELECT 'handover-' || s.year, COALESCE((SELECT max(split_part(number, '-', 3)::int) FROM "Handover" WHERE number LIKE 'DP-' || s.year || '-%'), 0) FROM settings s
) x
WHERE c.key = x.key;

SELECT key, value AS last_number_used FROM "Counter" ORDER BY key;

COMMIT;
```

Delivery Packs made before 20 Nov 2026 used the prefix `H-`. They don't count towards `DP-` numbering.

---

## 3. Renumber a quote

For example, the first quote came out as Q-2026-0002 because of a test, and should be Q-2026-0001. Also fixes the quote number in the lines of invoices made from it.

```sql
BEGIN;

-- SETTINGS
CREATE TEMP TABLE settings ON COMMIT DROP AS
SELECT 'Q-2026-0002'::text AS old_number, 'Q-2026-0001'::text AS new_number;

DO $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM settings;
  IF EXISTS (SELECT 1 FROM "Quote" WHERE number = s.new_number) THEN
    RAISE EXCEPTION '% already exists. Nothing changed.', s.new_number;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Quote" WHERE number = s.old_number) THEN
    RAISE EXCEPTION '% not found. Nothing changed.', s.old_number;
  END IF;
END $$;

UPDATE "Quote" q SET number = s.new_number FROM settings s WHERE q.number = s.old_number;

UPDATE "InvoiceItem" ii SET description = replace(ii.description, s.old_number, s.new_number)
FROM settings s, "Invoice" i, "Quote" q
WHERE ii."invoiceId" = i.id AND i."quoteId" = q.id AND q.number = s.new_number AND ii.description LIKE '%' || s.old_number || '%';

SELECT number, title, status FROM "Quote" q, settings s WHERE q.number IN (s.old_number, s.new_number);

COMMIT;
```

Then run **script 2** so the next quote number follows on.

---

## 4. Renumber a Project Delivery Pack

```sql
BEGIN;

-- SETTINGS
CREATE TEMP TABLE settings ON COMMIT DROP AS
SELECT 'DP-2026-0002'::text AS old_number, 'DP-2026-0001'::text AS new_number;

DO $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM settings;
  IF EXISTS (SELECT 1 FROM "Handover" WHERE number = s.new_number) THEN
    RAISE EXCEPTION '% already exists. Nothing changed.', s.new_number;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Handover" WHERE number = s.old_number) THEN
    RAISE EXCEPTION '% not found. Nothing changed.', s.old_number;
  END IF;
END $$;

-- The number is also stored inside the pack's saved content (printed on the PDF).
UPDATE "Handover" h
SET number = s.new_number, snapshot = jsonb_set(h.snapshot::jsonb, '{number}', to_jsonb(s.new_number))
FROM settings s WHERE h.number = s.old_number;

SELECT number, "issuedAt" FROM "Handover" h, settings s WHERE h.number IN (s.old_number, s.new_number);

COMMIT;
```

Then run **script 2**.

---

## 5. Remove one test invoice, with its receipts

Removes the invoice, its lines, its receipts and its "Follow up payment" task. If it came from a quote, that amount becomes "still to invoice" again on the quote.

```sql
BEGIN;

-- SETTINGS
CREATE TEMP TABLE settings ON COMMIT DROP AS SELECT 'INV-2026-0003'::text AS invoice_number;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Invoice" i, settings s WHERE i.number = s.invoice_number) THEN
    RAISE EXCEPTION 'Invoice not found. Nothing changed.';
  END IF;
END $$;

-- Preview
SELECT i.number, i.title, i.total, i.status, p."receiptNumber", p.amount
FROM "Invoice" i JOIN settings s ON i.number = s.invoice_number LEFT JOIN "Payment" p ON p."invoiceId" = i.id;

DELETE FROM "Activity" WHERE id = (SELECT i."followUpTaskId" FROM "Invoice" i, settings s WHERE i.number = s.invoice_number);
DELETE FROM "Payment"  WHERE "invoiceId" = (SELECT i.id FROM "Invoice" i, settings s WHERE i.number = s.invoice_number);
DELETE FROM "Invoice"  WHERE number = (SELECT invoice_number FROM settings);

COMMIT;
```

Then run **script 2**. If you removed the newest invoice, the next one reuses its number. If newer invoices exist, the number is left as a gap.

---

## 6. Remove one test receipt

The screen does this too: invoice → Payments → **Cancel**. Use this only if the screen isn't available. The invoice's paid amount and status are corrected.

```sql
BEGIN;

-- SETTINGS
CREATE TEMP TABLE settings ON COMMIT DROP AS SELECT 'RCT-2026-0002'::text AS receipt_number;

CREATE TEMP TABLE target ON COMMIT DROP AS
SELECT p.id, p."invoiceId", p.amount FROM "Payment" p, settings s WHERE p."receiptNumber" = s.receipt_number;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM target) THEN RAISE EXCEPTION 'Receipt not found. Nothing changed.'; END IF;
END $$;

DELETE FROM "Payment" WHERE id IN (SELECT id FROM target);

-- Correct the invoice: paid amount down; back to unpaid if it was marked paid; reopen its follow-up task.
UPDATE "Activity" SET "completedAt" = NULL
WHERE id IN (SELECT i."followUpTaskId" FROM "Invoice" i JOIN target t ON t."invoiceId" = i.id WHERE i.status = 'PAID');
UPDATE "Invoice" i SET "amountPaid" = i."amountPaid" - t.amount,
  status = CASE WHEN i.status = 'PAID' THEN 'ISSUED'::"InvoiceStatus" ELSE i.status END,
  "paidAt" = CASE WHEN i.status = 'PAID' THEN NULL ELSE i."paidAt" END
FROM target t WHERE i.id = t."invoiceId";

SELECT i.number, i.status, i.total, i."amountPaid" FROM "Invoice" i JOIN target t ON t."invoiceId" = i.id;

COMMIT;
```

Then run **script 2**.

---

## 7. Remove all invoices and receipts (test reset)

For a clean start before going live. **Removes every invoice and receipt in the CRM.** Read the preview before you change `ROLLBACK` to `COMMIT`.

```sql
BEGIN;

-- Preview: everything that will be removed.
SELECT i.number AS invoice, i.status, i.total, p."receiptNumber" AS receipt, p.amount
FROM "Invoice" i LEFT JOIN "Payment" p ON p."invoiceId" = i.id ORDER BY i.number;

DELETE FROM "Activity" WHERE id IN (SELECT "followUpTaskId" FROM "Invoice" WHERE "followUpTaskId" IS NOT NULL);
DELETE FROM "Payment";
DELETE FROM "Invoice";

-- Next ones are INV-…-0001 and RCT-…-0001.
UPDATE "Counter" SET value = 0 WHERE key LIKE 'invoice-%' OR key LIKE 'receipt-%';

SELECT (SELECT count(*) FROM "Invoice") AS invoices, (SELECT count(*) FROM "Payment") AS receipts;

ROLLBACK; -- change to COMMIT; when the preview is right
```

---

## 8. Remove all receipts, keep the invoices

Invoices go back to unpaid.

```sql
BEGIN;

SELECT p."receiptNumber", p.amount, i.number AS invoice FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId" ORDER BY 1;

DELETE FROM "Payment";
UPDATE "Activity" SET "completedAt" = NULL
WHERE id IN (SELECT "followUpTaskId" FROM "Invoice" WHERE "followUpTaskId" IS NOT NULL AND status = 'PAID');
UPDATE "Invoice" SET "amountPaid" = 0, status = 'ISSUED', "paidAt" = NULL WHERE status = 'PAID';
UPDATE "Invoice" SET "amountPaid" = 0 WHERE "amountPaid" <> 0;
UPDATE "Counter" SET value = 0 WHERE key LIKE 'receipt-%';

SELECT (SELECT count(*) FROM "Payment") AS receipts, (SELECT count(*) FROM "Invoice" WHERE "amountPaid" <> 0) AS invoices_with_payments;

ROLLBACK; -- change to COMMIT; when the preview is right
```

---

## 9. Remove a test quote, with its invoices and receipts

The screen can delete draft quotes. This one also removes an accepted test quote and everything invoiced from it.

```sql
BEGIN;

-- SETTINGS
CREATE TEMP TABLE settings ON COMMIT DROP AS SELECT 'Q-2026-0003'::text AS quote_number;

CREATE TEMP TABLE inv ON COMMIT DROP AS
SELECT i.id, i.number, i."followUpTaskId" FROM "Invoice" i JOIN "Quote" q ON q.id = i."quoteId", settings s WHERE q.number = s.quote_number;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Quote" q, settings s WHERE q.number = s.quote_number) THEN
    RAISE EXCEPTION 'Quote not found. Nothing changed.';
  END IF;
END $$;

-- Preview
SELECT q.number AS quote, q.title, q.status, (SELECT string_agg(number, ', ') FROM inv) AS invoices
FROM "Quote" q, settings s WHERE q.number = s.quote_number;

DELETE FROM "Activity" WHERE id IN (SELECT "followUpTaskId" FROM inv WHERE "followUpTaskId" IS NOT NULL);
DELETE FROM "Payment"  WHERE "invoiceId" IN (SELECT id FROM inv);
DELETE FROM "Invoice"  WHERE id IN (SELECT id FROM inv);
DELETE FROM "Quote"    WHERE number = (SELECT quote_number FROM settings); -- its lines go with it

COMMIT;
```

Then run **script 2**. If the deal's value came from this quote, edit the deal and correct its value.

---

## Before going live: avoid all this

Test on a **Preview** deployment with its own Neon branch (README → *Settings (environment variables)* → Preview). Test numbers then never touch the live CRM.
