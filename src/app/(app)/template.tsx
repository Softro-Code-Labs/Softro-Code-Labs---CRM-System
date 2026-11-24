/** Each new page fades gently into place (skipped for people who turn off animations). */
export default function PageTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
