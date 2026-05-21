/** Base64 transport for Yjs binary updates (browser + Node). */

export function encodeUpdate(update: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(update).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < update.length; i++) {
    binary += String.fromCharCode(update[i]!);
  }
  return btoa(binary);
}

export function decodeUpdate(encoded: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(encoded, "base64"));
  }
  const binary = atob(encoded);
  const update = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    update[i] = binary.charCodeAt(i);
  }
  return update;
}
