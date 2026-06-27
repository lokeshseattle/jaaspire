import {
  PlayInstallReferrer,
  type PlayInstallReferrerError,
  type PlayInstallReferrerInfo,
} from "react-native-play-install-referrer";

import {
  extractReferrerAttribution,
  type ReferrerAttribution,
} from "./attribution.parser";

function getInstallReferrerString(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      PlayInstallReferrer.getInstallReferrerInfo(
        (
          info: PlayInstallReferrerInfo | null,
          error: PlayInstallReferrerError | null,
        ) => {
          try {
            if (error || !info?.installReferrer) {
              resolve(null);
              return;
            }

            resolve(info.installReferrer);
          } catch {
            resolve(null);
          }
        },
      );
    } catch {
      resolve(null);
    }
  });
}

export type AndroidReferrerResult = {
  attribution: ReferrerAttribution;
  rawReferrer: string;
};

export async function getAndroidReferrerAttribution(): Promise<AndroidReferrerResult | null> {
  try {
    const raw = await getInstallReferrerString();
    if (!raw) return null;

    const parsed = extractReferrerAttribution(raw);

    return {
      attribution: { ...(parsed ?? {}), referrer: raw },
      rawReferrer: raw,
    };
  } catch {
    return null;
  }
}
