import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PasswordForm } from "@/components/crm/password-form";
import { ProfileForm } from "./profile-form";
import { CalendarCard, NotificationsCard } from "./notifications-card";
import { emailConfigured } from "@/lib/integrations/email";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const me = await requireActiveUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="My profile" description={user.email} />
      <Card>
        <CardHeader title="Your details" />
        <CardBody>
          <ProfileForm initial={{ name: user.name, jobTitle: user.jobTitle ?? "", phone: user.phone ?? "" }} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Notifications" description={`Emails go to ${user.email}.`} />
        <CardBody>
          <NotificationsCard initial={{ emailNotifications: user.emailNotifications, dailyDigest: user.dailyDigest }} emailReady={emailConfigured()} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Calendar" />
        <CardBody>
          <CalendarCard hasLink={Boolean(user.calendarTokenHash)} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Your role" />
        <CardBody className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
          <Badge tone="brand">{ROLE_LABELS[user.role]}</Badge>
          {ROLE_DESCRIPTIONS[user.role]}. Ask an admin to change it.
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Password"
          description={user.passwordChangedAt ? `Last changed ${formatDate(user.passwordChangedAt)}. Changing it signs out your other devices.` : "Changing it signs out your other devices."}
        />
        <CardBody>
          <PasswordForm redirectTo="" />
        </CardBody>
      </Card>
    </div>
  );
}
