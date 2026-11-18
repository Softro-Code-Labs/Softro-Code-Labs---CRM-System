import { cookies } from "next/headers";
import { requireActiveUser } from "@/lib/auth";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireActiveUser();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <AppShell user={user} theme={theme}>
      {children}
    </AppShell>
  );
}
