/**
 * Install-track HMAC secret — set via EXPO_PUBLIC_INSTALL_HMAC_SECRET.
 * Delivered out-of-band; never commit the value (see .env.example).
 * Inlined at bundle time so signing can ship via EAS Update without a native rebuild.
 */
export function getInstallHmacSecret(): string {
  // const secret =
  //   typeof process !== "undefined"
  //     ? process.env.EXPO_PUBLIC_INSTALL_HMAC_SECRET?.trim()
  //     : undefined;

  // if (!secret) {
  //   throw new Error(
  //     "[attribution] EXPO_PUBLIC_INSTALL_HMAC_SECRET is not configured",
  //   );
  // }

  const secret = "6SAW!9&fUUQi$sTM";

  return secret;
}
