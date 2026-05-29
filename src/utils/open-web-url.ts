import {
  openBrowserAsync,
  WebBrowserPresentationStyle,
} from "expo-web-browser";

export async function openWebUrl(url: string): Promise<void> {
  await openBrowserAsync(url, {
    presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
  });
}
