import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/whatsapp";
import { buttonClass } from "@/components/ui/button";

export function WhatsAppButton({ phone, message, size = "md" }: { phone: string | null | undefined; message?: string; size?: "sm" | "md" }) {
  const href = whatsappLink(phone, message);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", size, "text-emerald-700")}>
      <MessageCircle className="size-4" aria-hidden /> WhatsApp
    </a>
  );
}
