import path from "node:path";
import { Defs, Font, LinearGradient, Path, Stop, Svg } from "@react-pdf/renderer";

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

