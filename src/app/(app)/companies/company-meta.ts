import type { CompanyType } from "@/generated/prisma/enums";
import type { BadgeTone } from "@/components/ui/badge";
import { EMPLOYEE_SIZES } from "@/lib/validation/company";

export const companyTypeTone: Record<CompanyType, BadgeTone> = {
  PROSPECT: "blue",
  CUSTOMER: "green",
  PARTNER: "purple",
  VENDOR: "amber",
  FORMER_CUSTOMER: "gray",
};

export const COMPANY_TYPE_OPTIONS: { value: CompanyType; label: string }[] = [
  { value: "PROSPECT", label: "Prospect" },
  { value: "CUSTOMER", label: "Customer" },
  { value: "PARTNER", label: "Partner" },
  { value: "VENDOR", label: "Vendor" },
  { value: "FORMER_CUSTOMER", label: "Former customer" },
];

export const EMPLOYEE_SIZE_OPTIONS = EMPLOYEE_SIZES.map((s) => ({ value: s, label: `${s} employees` }));

export const INDUSTRY_SUGGESTIONS = [
  "Banking & Finance",
  "E-commerce & Retail",
  "Education",
  "Healthcare",
  "Hospitality & Tourism",
  "Logistics",
  "Manufacturing",
  "Media & Marketing",
  "Real Estate",
  "Software & SaaS",
  "Telecommunications",
  "Government & NGO",
  "Apparel",
];
