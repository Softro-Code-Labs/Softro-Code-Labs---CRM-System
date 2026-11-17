import "server-only";

/**
 * The visitor's IP address. On Vercel, x-forwarded-for is set by the platform
 * (the first address is the client). Elsewhere it's only trusted behind a proxy you control.
 */
export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = headers.get("x-real-ip")?.trim() || forwarded || "unknown";
  return ip.slice(0, 64);
}
