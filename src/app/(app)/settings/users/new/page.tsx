import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { UserForm } from "../user-form";
import { getManagers } from "@/lib/queries/users";
import { createUser } from "../actions";

export const metadata: Metadata = { title: "Add team member" };

export default async function NewUserPage() {
  await requirePermission("user:manage");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Add team member"
        description="We'll create a temporary password for them to change when they first sign in."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Team members", href: "/settings/users" }, { label: "Add" }]}
      />
      <UserForm action={createUser} initial={{ name: "", email: "", role: "SALES", jobTitle: "", phone: "", managerId: "" }} managers={await getManagers()} />
    </div>
  );
}
