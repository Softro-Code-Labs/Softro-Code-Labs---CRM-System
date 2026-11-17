/** Public address of the CRM, used in links inside emails, chat messages and calendar events. */
export function appUrl(path = "") {
  const base =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}${path}`;
}
