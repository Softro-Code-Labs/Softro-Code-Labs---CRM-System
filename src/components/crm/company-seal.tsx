import { SEAL_COLOR, SEAL_LABEL, SEAL_PATHS, SEAL_SIZE } from "@/lib/seal-artwork";
import { sealLabel, type SealInfo } from "@/lib/seal";
import { formatDate } from "@/lib/utils";
import { signatureDataUrl } from "@/lib/signature-url";

/** The company seal, for on-screen previews. Same artwork as the PDFs. */
export function CompanySeal({ registrationNo, size = 120, className }: { registrationNo?: string | null; size?: number; className?: string }) {
  const label = sealLabel(registrationNo);
  return (
    <svg viewBox={`0 0 ${SEAL_SIZE} ${SEAL_SIZE}`} width={size} height={size} className={className} role="img" aria-label="Company seal">
      {SEAL_PATHS.map((d, i) => (
        <path key={i} d={d} fill={SEAL_COLOR} fillRule="evenodd" />
      ))}
      <text
        x={SEAL_SIZE / 2}
        y={SEAL_LABEL.y}
        textAnchor="middle"
        fill={SEAL_COLOR}
        fontSize={SEAL_LABEL.size * label.scale}
        fontWeight={600}
        letterSpacing={SEAL_LABEL.letterSpacing * label.scale}
        style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
      >
        {label.text}
      </text>
    </svg>
  );
}

/** Signature, seal, name and title, in the "For Softro Code Labs" box of a sealed document preview. */
export function SealedSignature({ seal, registrationNo }: { seal: SealInfo; registrationNo?: string | null }) {
  const src = signatureDataUrl(seal.signature);
  return (
    <div>
      <div className="relative h-24">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element -- small inline data URL
          <img src={src} alt={`Signature of ${seal.signerName}`} className="absolute bottom-1 left-0 h-12 w-auto max-w-[60%] object-contain" />
        )}
        <CompanySeal registrationNo={registrationNo} size={96} className="absolute right-2 bottom-[-14px] -rotate-6 opacity-90" />
      </div>
      <div className="border-b border-ink-300" />
      <p className="mt-1 text-ink-800">{seal.signerName}</p>
      <p>
        {seal.signerTitle ? `${seal.signerTitle} · ` : ""}Sealed {formatDate(seal.sealedAt)}
      </p>
    </div>
  );
}
