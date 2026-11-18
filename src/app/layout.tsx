import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { parseTheme, SYSTEM_THEME_SCRIPT, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Softro CRM", template: "%s · Softro CRM" },
  description: "Customer relationship management for Softro Code Labs",
  robots: { index: false, follow: false },
};

export async function generateViewport(): Promise<Viewport> {
  const pref = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return { themeColor: pref === "light" ? "#f8f6f2" : "#111013" };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Dark unless this browser chose otherwise. Set on the server, so pages never flash the wrong theme.
  const pref = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="en"
      data-theme={pref === "light" ? "light" : "dark"}
      data-theme-pref={pref}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <head>{pref === "system" && <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} />}</head>
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
