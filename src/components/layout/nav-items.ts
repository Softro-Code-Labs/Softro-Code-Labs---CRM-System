import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarCheck,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
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
      { label: "Quotes", href: "/quotes", icon: FileText, soon: true },
    ],
  },
  {
    title: "Customers",
    items: [
      { label: "Companies", href: "/companies", icon: Building2, permission: "company:view" },
      { label: "Contacts", href: "/contacts", icon: Users, permission: "contact:view" },
      { label: "Activities", href: "/activities", icon: CalendarCheck, permission: "activity:view" },
      { label: "Support", href: "/support", icon: LifeBuoy, soon: true },
    ],
  },
  {
    title: "Insights",
    items: [{ label: "Reports", href: "/reports", icon: BarChart3, soon: true }],
  },
  {
    title: "Admin",
    items: [{ label: "Settings", href: "/settings", icon: Settings, permission: "user:manage", soon: true }],
  },
];
