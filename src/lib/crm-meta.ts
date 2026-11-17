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

export const DEAL_STATUS_TONE: Record<DealStatus, BadgeTone> = { OPEN: "blue", WON: "green", LOST: "red" };

export const LANGUAGE_LABELS: Record<PreferredLanguage, string> = { ENGLISH: "English", SINHALA: "Sinhala" };
export const LANGUAGE_OPTIONS = options(LANGUAGE_LABELS);

export const CURRENCIES = ["LKR", "USD", "EUR", "GBP", "AUD", "AED"] as const;
export const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));
