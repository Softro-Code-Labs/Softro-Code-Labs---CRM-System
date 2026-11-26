import {
  BarChart3,
  BadgePercent,
  Briefcase,
  Building2,
  CalendarCheck,
  FileSignature,
  KeyRound,
  FileText,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  Settings,
  Target,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  /** A different name for admins, who see every team rather than their own. */
  adminLabel?: string;
  /** Modules planned for later steps show as "Soon" and are not clickable. */
  soon?: boolean;
};

export const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:view" }],
  },
  {
    title: "Sales",
    items: [
      { label: "Leads", href: "/leads", icon: Target, permission: "lead:view" },
      { label: "Deals", href: "/deals", icon: Briefcase, permission: "deal:view" },
      { label: "Quotes", href: "/quotes", icon: FileText, permission: "quote:view" },
      { label: "Invoices", href: "/invoices", icon: Receipt, permission: "invoice:view" },
    ],
  },
  {
    title: "Customers",
    items: [
      { label: "Companies", href: "/companies", icon: Building2, permission: "company:view" },
      { label: "Contacts", href: "/contacts", icon: Users, permission: "contact:view" },
      { label: "Activities", href: "/activities", icon: CalendarCheck, permission: "activity:view" },
      { label: "Contracts", href: "/contracts", icon: FileSignature, permission: "contract:view" },
      { label: "Project access", href: "/access", icon: KeyRound, permission: "access:view" },
      { label: "Support", href: "/support", icon: LifeBuoy, permission: "ticket:view" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Income", href: "/finance", icon: Landmark, permission: "finance:view" },
      { label: "Commissions", href: "/commissions", icon: BadgePercent, permission: "commission:view" },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3, permission: "report:view" },
      { label: "My team", adminLabel: "Teams", href: "/team", icon: UsersRound, permission: "team:view" },
    ],
  },
  {
    title: "Admin",
    items: [{ label: "Settings", href: "/settings", icon: Settings, permission: "settings:view" }],
  },
];
