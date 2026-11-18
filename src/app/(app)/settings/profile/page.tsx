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
import { AvatarCard } from "./avatar-card";
import { avatarUrl } from "@/lib/avatar";
import { CalendarCard, NotificationsCard } from "./notifications-card";
import { emailConfigured } from "@/lib/integrations/email";
import { TwoFactorCard } from "./two-factor-card";
import { ThemeChooser } from "@/components/theme/theme-switcher";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { cookies } from "next/headers";
import { TWO_FACTOR_ROLES, twoFactorPolicy } from "@/lib/security/two-factor";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ recovery?: string }> }) {
  const me = await requireActiveUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  const { recovery } = await searchParams;
  const required = TWO_FACTOR_ROLES.includes(user.role) && (await twoFactorPolicy()).required;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="My profile" description={user.email} />
      <Card>
        <CardHeader title="Your details" />
        <CardBody className="space-y-6">
          <AvatarCard name={user.name} initialUrl={avatarUrl(user)} />
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
        <CardHeader title="Appearance" description="Saved on this browser. Dark is the default." />
        <CardBody>
          <ThemeChooser initial={parseTheme((await cookies()).get(THEME_COOKIE)?.value)} />
        </CardBody>
      </Card>
      <Card id="two-step">
        <CardHeader title="Two-step sign-in" />
        <CardBody>
          {recovery && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">You signed in with a recovery code. If you&apos;ve lost your phone, turn two-step sign-in off and on again with your new phone, or make new recovery codes.</p>}
          <TwoFactorCard enabled={Boolean(user.totpEnabledAt)} recoveryLeft={user.recoveryCodeHashes.length} required={required} />
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
