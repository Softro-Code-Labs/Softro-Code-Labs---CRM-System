/**
 * Warranty and non-disclosure agreement for the Project Delivery Pack.
 * Admins edit the wording under Settings → Warranty & NDA; empty wording falls back to the text below.
 *
 * Writing rules (kept simple so anyone can edit them):
 *   - a blank line starts a new paragraph
 *   - a line starting with "## " is a heading
 *   - a line starting with "- " or "• " is a bullet point
 *   - {fields} in braces are filled in for each project (see DOC_FIELDS)
 */

export const DOC_FIELDS: { key: string; meaning: string }[] = [
  { key: "company", meaning: "Our company name (from Company details)" },
  { key: "client", meaning: "The client's company name, or the contact's name" },
  { key: "project", meaning: "The project (deal) name" },
  { key: "deliveryDate", meaning: "The date the Delivery Pack is made" },
  { key: "supportMonths", meaning: "Free bug-fix period in months" },
  { key: "supportUntil", meaning: "The date free bug fixes end" },
  { key: "warrantyMonths", meaning: "Warranty period in months" },
  { key: "warrantyUntil", meaning: "The date the warranty ends" },
];

export const DEFAULT_WARRANTY = `This warranty is given by {company} to {client} for the project "{project}", delivered on {deliveryDate}.

## 1. Free bug fixes ({supportMonths} months, until {supportUntil})
During this period we fix, at no cost, any bug in the work we delivered: anything that does not work as agreed in the quotation and the approved design.

## 2. Warranty ({warrantyMonths} months, until {warrantyUntil})
For this period we warrant that the features in the quotation keep working as delivered, on the platforms and versions agreed at launch. If a defect in our work appears, we fix it at no cost.

## 3. What is not covered
- New features, design changes or changes of mind after approval.
- Problems caused by changes made by the client, their staff or other developers.
- Hosting, domain, email or third-party service outages, expiries or price changes.
- Updates needed because of new iOS, Android, browser or platform versions released after launch.
- Lost or wrong data entered by users, and passwords that were shared or not changed after handover.
- Accounts or services the client did not renew on time.

## 4. How to report a problem
Contact us by email or WhatsApp with a short description, the page or screen, and a screenshot if you can. We reply within 2 working days and tell you when it will be fixed.

## 5. After the warranty
Support, updates and changes are available on a maintenance plan or charged per job.

This warranty does not limit any rights the client has under Sri Lankan law.`;

export const DEFAULT_NDA = `This mutual non-disclosure agreement is between {company} and {client} for the project "{project}", from {deliveryDate}.

## 1. Confidential information
Any business, technical or personal information either party shares with the other for the project, including source code, designs, customer data, prices, plans and login details.

## 2. What each party agrees
- Use the other party's confidential information only for this project.
- Keep it secure and share it only with staff or contractors who need it and who are bound by the same duty.
- Not sell, publish or give it to anyone else.
- Return or delete it when asked, once the project or support ends.

## 3. What is not confidential
- Information that is already public, or becomes public without either party breaking this agreement.
- Information a party already had, or received lawfully from someone else.
- Information that must be shared by law or a court order, after telling the other party where allowed.

## 4. Portfolio
{company} may mention the project name and show screenshots in its portfolio only with the client's written agreement.

## 5. How long it lasts
This agreement lasts during the project and for 3 years after it ends. Duties about passwords and personal data last as long as that information exists.

## 6. Law
This agreement is governed by the laws of Sri Lanka.`;

export type DocVars = Record<string, string>;

/** Puts the project's details into the wording. Unknown {fields} are left as they are. */
export function fillDoc(text: string, vars: DocVars) {
  return text.replace(/\{(\w+)\}/g, (all, key: string) => vars[key] ?? all);
}

export type DocBlock = { kind: "h" | "p" | "li"; text: string };

/** Splits wording into headings, paragraphs and bullet points for printing. */
export function parseDoc(text: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) flush();
    else if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "h", text: line.slice(3).trim() });
    } else if (/^[-•]\s+/.test(line)) {
      flush();
      blocks.push({ kind: "li", text: line.replace(/^[-•]\s+/, "") });
    } else para.push(line);
  }
  flush();
  return blocks;
}

/** Adds whole months to a date (e.g. 4 months of free bug fixes from the delivery date). */
export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
