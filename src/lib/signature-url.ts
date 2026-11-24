/** A data: URL for showing a stored signature (PNG) in the browser. */
export function signatureDataUrl(data: Uint8Array | null | undefined) {
  return data ? `data:image/png;base64,${Buffer.from(data).toString("base64")}` : null;
}
