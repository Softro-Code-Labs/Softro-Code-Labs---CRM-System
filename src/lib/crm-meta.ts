import type { AccountOwner, PaymentMethod, ServiceCategory, SignInMethod, TwoStepMethod } from "@/generated/prisma/enums";
import type { DealStatus, LeadSource, LeadStatus, PreferredLanguage, ServiceType } from "@/generated/prisma/enums";
import type { BadgeTone } from "@/components/ui/badge";

type Option<T extends string> = { value: T; label: string };

function options<T extends string>(labels: Record<T, string>): Option<T>[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  WEBSITE_WEB_APP: "Website or web app",
  MOBILE_APP: "Mobile app",
  ONLINE_STORE: "Online store",
  BUSINESS_SYSTEM: "Business system (ERP, CRM, POS, booking)",
  AI_AUTOMATION: "AI or automation",
  CUSTOM_SOFTWARE: "Custom software",
  SAAS_PLATFORM: "SaaS / LMS / cloud platform",
  LAB_PRODUCT: "Lab product (e.g. Surelane)",
  MAINTENANCE_SUPPORT: "Maintenance & support",
  NOT_SURE: "Not sure yet",
};
export const SERVICE_TYPE_OPTIONS = options(SERVICE_TYPE_LABELS);

/** Short labels for badges and board cards. */
export const SERVICE_TYPE_SHORT: Record<ServiceType, string> = {
  WEBSITE_WEB_APP: "Web",
  MOBILE_APP: "Mobile",
  ONLINE_STORE: "Store",
  BUSINESS_SYSTEM: "Business system",
  AI_AUTOMATION: "AI",
  CUSTOM_SOFTWARE: "Custom",
  SAAS_PLATFORM: "SaaS",
  LAB_PRODUCT: "Lab",
  MAINTENANCE_SUPPORT: "Support",
  NOT_SURE: "Not sure",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE_FORM: "Website form",
  WHATSAPP: "WhatsApp",
  WEBSITE: "Website (other)",
  REFERRAL: "Referral",
  LINKEDIN: "LinkedIn",
  EMAIL: "Email",
  PHONE: "Phone call",
  EVENT: "Event",
  COLD_OUTREACH: "Cold outreach",
  PARTNER: "Partner",
  UPWORK_FIVERR: "Upwork / Fiverr",
  OTHER: "Other",
};
export const LEAD_SOURCE_OPTIONS = options(LEAD_SOURCE_LABELS);

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  UNQUALIFIED: "Unqualified",
  CONVERTED: "Converted",
};
export const LEAD_STATUS_OPTIONS = options(LEAD_STATUS_LABELS);
export const LEAD_STATUS_TONE: Record<LeadStatus, BadgeTone> = {
  NEW: "blue",
  CONTACTED: "amber",
  QUALIFIED: "purple",
  UNQUALIFIED: "gray",
  CONVERTED: "green",
};
export const OPEN_LEAD_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED"];

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = { OPEN: "Open", WON: "Won", LOST: "Lost" };
export const DEAL_STATUS_TONE: Record<DealStatus, BadgeTone> = { OPEN: "blue", WON: "green", LOST: "red" };

export const LANGUAGE_LABELS: Record<PreferredLanguage, string> = { ENGLISH: "English", SINHALA: "Sinhala" };
export const LANGUAGE_OPTIONS = options(LANGUAGE_LABELS);

export const CURRENCIES = ["LKR", "USD", "EUR", "GBP", "AUD", "AED"] as const;
export const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));

export const ACTIVITY_TYPE_LABELS: Record<import("@/generated/prisma/enums").ActivityType, string> = {
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  MEETING: "Meeting",
  TASK: "Task",
};
export const ACTIVITY_TYPE_OPTIONS = options(ACTIVITY_TYPE_LABELS);

export const PRIORITY_LABELS: Record<import("@/generated/prisma/enums").ActivityPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};
export const PRIORITY_OPTIONS = options(PRIORITY_LABELS);

export const QUOTE_STATUS_LABELS: Record<import("@/generated/prisma/enums").QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
};
export const QUOTE_STATUS_TONE: Record<import("@/generated/prisma/enums").QuoteStatus, BadgeTone> = {
  DRAFT: "gray",
  SENT: "blue",
  ACCEPTED: "green",
  DECLINED: "red",
};

/** Common units for quote lines. People can also type their own. */
export const QUOTE_UNITS = ["project", "hour", "day", "month", "year", "page", "screen", "licence", "user", "item"];

type E = typeof import("@/generated/prisma/enums");
type ContractType = E["ContractType"][keyof E["ContractType"]];
type ContractStatus = E["ContractStatus"][keyof E["ContractStatus"]];
type BillingCycle = E["BillingCycle"][keyof E["BillingCycle"]];
type TicketStatus = E["TicketStatus"][keyof E["TicketStatus"]];
type TicketPriority = E["TicketPriority"][keyof E["TicketPriority"]];
type TicketChannel = E["TicketChannel"][keyof E["TicketChannel"]];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  MAINTENANCE: "Maintenance (AMC)",
  SUPPORT: "Support / SLA",
  HOSTING: "Hosting & domain",
  RETAINER: "Development retainer",
  SUBSCRIPTION: "Subscription (SaaS / Lab product)",
  OTHER: "Other",
};
export const CONTRACT_TYPE_OPTIONS = options(CONTRACT_TYPE_LABELS);

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = { ACTIVE: "Active", PAUSED: "Paused", ENDED: "Ended", CANCELLED: "Cancelled" };
export const CONTRACT_STATUS_TONE: Record<ContractStatus, BadgeTone> = { ACTIVE: "green", PAUSED: "amber", ENDED: "gray", CANCELLED: "red" };

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", YEARLY: "Yearly", ONE_TIME: "One-time" };
export const BILLING_CYCLE_OPTIONS = options(BILLING_CYCLE_LABELS);
export const BILLING_CYCLE_SHORT: Record<BillingCycle, string> = { MONTHLY: "/ month", QUARTERLY: "/ quarter", YEARLY: "/ year", ONE_TIME: "one-time" };

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_ON_CLIENT: "Waiting on client",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};
export const TICKET_STATUS_OPTIONS = options(TICKET_STATUS_LABELS);
export const TICKET_STATUS_TONE: Record<TicketStatus, BadgeTone> = {
  OPEN: "blue",
  IN_PROGRESS: "purple",
  WAITING_ON_CLIENT: "amber",
  RESOLVED: "green",
  CLOSED: "gray",
};
export const OPEN_TICKET_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT"];

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };
export const TICKET_PRIORITY_OPTIONS = options(TICKET_PRIORITY_LABELS);
export const TICKET_PRIORITY_TONE: Record<TicketPriority, BadgeTone> = { LOW: "gray", MEDIUM: "blue", HIGH: "amber", URGENT: "red" };
/** First-response target when the client has no contract SLA. */
export const DEFAULT_RESPONSE_HOURS: Record<TicketPriority, number> = { URGENT: 4, HIGH: 24, MEDIUM: 48, LOW: 72 };

export const TICKET_CHANNEL_LABELS: Record<TicketChannel, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  PHONE: "Phone",
  WEBSITE: "Website",
  IN_PERSON: "In person",
  OTHER: "Other",
};
export const TICKET_CHANNEL_OPTIONS = options(TICKET_CHANNEL_LABELS);

/* ── Project access register ───────────────────────────────────────────── */

export const TWO_STEP_LABELS: Record<TwoStepMethod, string> = {
  AUTHENTICATOR: "Authenticator app",
  SECURITY_KEY: "Security key",
  SMS: "Text message (SMS)",
  NONE: "Not turned on",
};
export const TWO_STEP_OPTIONS = options(TWO_STEP_LABELS);

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  DOMAIN: "Domain & DNS",
  HOSTING: "Hosting",
  CODE: "Code",
  DATABASE: "Database",
  EMAIL: "Email",
  PAYMENTS: "Payments",
  STORAGE: "Files & storage",
  ANALYTICS: "Analytics & SEO",
  OTHER: "Other",
};
export const SERVICE_CATEGORY_OPTIONS = options(SERVICE_CATEGORY_LABELS);

export const SIGN_IN_LABELS: Record<SignInMethod, string> = {
  GOOGLE: "Sign in with Google",
  PASSWORD_IN_GOOGLE: "Email + password (saved in Google)",
  OTHER: "Other (see notes)",
};
export const SIGN_IN_OPTIONS = options(SIGN_IN_LABELS);

export const ACCOUNT_OWNER_LABELS: Record<AccountOwner, string> = { SOFTRO: "Softro", CLIENT: "Client", SHARED: "Shared" };
export const ACCOUNT_OWNER_OPTIONS = options(ACCOUNT_OWNER_LABELS);

/** Close-out checklist, in the order it's done. */
export const ACCESS_CHECKLIST = [
  { key: "passwordsSaved", label: "Every login is saved in the project's Google account (or the password manager)" },
  { key: "backupCodesSaved", label: "The Gmail password and 2-step backup codes are in the password manager" },
  { key: "envSaved", label: "Settings (.env) are saved: in Vercel, or a copy in the project's Google Drive" },
  { key: "clientHandedOver", label: "Client has what they need: handover document sent, ownership moved where agreed" },
  { key: "browserProfileGone", label: "The project's browser profile is removed" },
  { key: "localFilesDeleted", label: "Local .env files and downloads are deleted from team computers" },
] as const;
export type AccessChecklistKey = (typeof ACCESS_CHECKLIST)[number]["key"];

/** Sign in to each project Gmail at least this often. Google can delete personal accounts unused for 2 years. */
export const ACCESS_CHECK_EVERY_DAYS = 182;

/* ── Invoices and payments ─────────────────────────────────────────── */
export type InvoiceState = "unpaid" | "due-soon" | "part-paid" | "overdue" | "paid" | "void";
export const INVOICE_STATE_LABELS: Record<InvoiceState, string> = {
  unpaid: "Unpaid",
  "due-soon": "Due soon",
  "part-paid": "Part paid",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
};
export const INVOICE_STATE_TONE: Record<InvoiceState, BadgeTone> = {
  unpaid: "blue",
  "due-soon": "amber",
  "part-paid": "purple",
  overdue: "red",
  paid: "green",
  void: "gray",
};
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
  CARD: "Card",
  ONLINE: "Online (PayHere, Stripe…)",
  OTHER: "Other",
};
export const PAYMENT_METHOD_OPTIONS = options(PAYMENT_METHOD_LABELS);
