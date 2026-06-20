import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import { getInstallHmacSecret } from "./attribution.secrets";

export type InstallSignatureHeaders = {
  "X-Install-Timestamp": string;
  "X-Install-Signature": string;
};

/** hex(hmac_sha256(secret, "{timestamp}:{device_id}")) */
export function buildInstallSignatureHeaders(
  deviceId: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000),
): InstallSignatureHeaders {
  const secret = getInstallHmacSecret();
  const timestamp = String(timestampSeconds);
  const message = `${timestamp}:${deviceId}`;
  const signature = bytesToHex(
    hmac(sha256, utf8ToBytes(secret), utf8ToBytes(message)),
  );

  return {
    "X-Install-Timestamp": timestamp,
    "X-Install-Signature": signature,
  };
}
