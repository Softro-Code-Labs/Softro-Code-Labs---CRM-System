import path from "node:path";
import { Defs, Font, Image, LinearGradient, Path, Stop, Svg, Text, View } from "@react-pdf/renderer";
import { SEAL_COLOR, SEAL_LABEL, SEAL_PATHS, SEAL_SIZE } from "@/lib/seal-artwork";
import { sealLabel, type SealInfo } from "@/lib/seal";
import { formatDate } from "@/lib/utils";

/** Shared look for every Softro PDF (quotes, handover documents). */

// Geist, the same typeface as the CRM and softrocodelabs.com (SIL Open Font License).
const fontDir = path.join(process.cwd(), "src", "assets", "fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(fontDir, "Geist-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "Geist-Medium.ttf"), fontWeight: 500 },
    { src: path.join(fontDir, "Geist-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(fontDir, "Geist-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]); // don't break words with hyphens

export const INK = "#161517";
export const MUTED = "#6e6962";
export const LIGHT = "#8f8a82";
export const LINE = "#e2ddd4";
export const CRIMSON = "#a70b21";


/** The Softro Code Labs mark, same artwork as the website. */
export function Mark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="10 15.5 170 170">
      <Defs>
        <LinearGradient id="g" x1="0" y1="40" x2="0" y2="170" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#A70B21" />
          <Stop offset="1" stopColor="#EF4C5B" />
        </LinearGradient>
      </Defs>
      <Path
        fill="url(#g)"
        fillRule="evenodd"
        d="M111.5 24 L47 54.5 L47 102 L98.5 121.5 L98.5 154 L83 146 L83 121.4 L69 116.3 L69 154.6 L112.6 177 L112.6 78 L98.3 83.2 L98.3 105.9 L83 100.4 L83 83.4 L129 66.4 L129 117 L117 113 L117 127.5 L143.3 137 L143.3 46.8 L112.6 57 L112.6 24 Z M98.3 45.4 L98.3 62.4 L69 73.2 L69 95.2 L61.2 92.8 L61.2 63.5 Z"
      />
    </Svg>
  );
}


/** The company seal. The registration number (or "OFFICIAL") is set under the mark. */
export function SealPdf({ size, registrationNo }: { size: number; registrationNo?: string | null }) {
  const k = size / SEAL_SIZE;
  const label = sealLabel(registrationNo);
  const fontSize = SEAL_LABEL.size * label.scale * k;
  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${SEAL_SIZE} ${SEAL_SIZE}`}>
        {SEAL_PATHS.map((d, i) => (
          <Path key={i} d={d} fill={SEAL_COLOR} fillRule="evenodd" />
        ))}
      </Svg>
      <Text
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: SEAL_LABEL.y * k - fontSize * 0.95,
          textAlign: "center",
          fontSize,
          fontWeight: 600,
          letterSpacing: SEAL_LABEL.letterSpacing * label.scale * k,
          color: SEAL_COLOR,
          lineHeight: 1,
        }}
      >
        {label.text}
      </Text>
    </View>
  );
}

/**
 * Signature line for a sealed document: the signer's signature on the line, the seal stamped
 * over its right end, then the signer's name and title. `width` is the box width in points.
 */
export function SealedSignaturePdf({ seal, registrationNo, width, caption }: { seal: SealInfo; registrationNo?: string | null; width: number; caption?: string }) {
  const sealSize = 92;
  const textRoom = width - sealSize * 0.8; // keep the name and title clear of the seal
  return (
    <View style={{ width }}>
      <View style={{ height: 58, position: "relative" }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf images have no alt text */}
        <Image src={{ data: Buffer.from(seal.signature), format: "png" }} style={{ position: "absolute", left: 0, bottom: 2, height: 36, maxWidth: width - sealSize * 0.6, objectFit: "contain", objectPosition: "left bottom" }} />
        <View style={{ position: "absolute", right: 0, bottom: -22, transform: "rotate(-6deg)", opacity: 0.92 }}>
          <SealPdf size={sealSize} registrationNo={registrationNo} />
        </View>
      </View>
      <View style={{ borderBottomWidth: 0.75, borderBottomColor: MUTED, marginBottom: 4 }} />
      <View style={{ width: textRoom }}>
        <Text style={{ fontSize: 8.5, color: INK, fontWeight: 500 }}>{seal.signerName}</Text>
        {seal.signerTitle ? <Text style={{ fontSize: 8.5, color: MUTED }}>{seal.signerTitle}</Text> : null}
        {caption ? <Text style={{ fontSize: 8.5, color: MUTED }}>{caption}</Text> : null}
        <Text style={{ fontSize: 7.5, color: LIGHT }}>Sealed {formatDate(seal.sealedAt)}</Text>
      </View>
    </View>
  );
}
