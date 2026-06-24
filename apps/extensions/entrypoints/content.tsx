import { render } from "solid-js/web";
import { browser } from "wxt/browser";
import { SavePanel, type ActivePage } from "../lib/savePanel";
import { savePanelStyles } from "../lib/savePanelStyles";

let host: HTMLElement | null = null;
let disposePanel: (() => void) | null = null;

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  noScriptStartedPostMessage: true,
  main() {
    if (isOAuthCallbackPage()) {
      finishOAuthCallbackFromPage();
      return;
    }

    browser.runtime.onMessage.addListener((message) => {
      if (isToggleMessage(message)) {
        toggleSavePanel(message.previewImageUrl);
      }
    });
  }
});

const toggleSavePanel = (previewImageUrl: string | null) => {
  if (host) {
    closeSavePanel();
    return;
  }

  const nextHost = document.createElement("shelf-save-panel");
  nextHost.style.position = "fixed";
  nextHost.style.inset = "0";
  nextHost.style.zIndex = "2147483647";
  nextHost.style.pointerEvents = "auto";

  const shadow = nextHost.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = savePanelStyles;
  const root = document.createElement("div");

  shadow.append(style, root);
  document.documentElement.append(nextHost);
  host = nextHost;
  disposePanel = render(
    () => <SavePanel initialPage={readActivePage(previewImageUrl)} onClose={closeSavePanel} />,
    root
  );
};

const closeSavePanel = () => {
  disposePanel?.();
  disposePanel = null;
  host?.remove();
  host = null;
};

const isOAuthCallbackPage = () =>
  location.pathname === "/oauth/browser-extension/callback" &&
  (new URL(location.href).searchParams.has("code") || new URL(location.href).searchParams.has("error"));

const finishOAuthCallbackFromPage = () => {
  const root = document.createElement("main");

  root.style.cssText =
    "min-height:100vh;display:grid;place-items:center;margin:0;background:#f8fafc;color:#20242d;font:14px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
  root.textContent = "Finishing Shelf connection...";
  document.documentElement.replaceChildren(document.createElement("head"), document.createElement("body"));
  document.body.append(root);

  browser.runtime
    .sendMessage({
      callbackUrl: location.href,
      type: "shelf:oauthCallback"
    })
    .then((response) => {
      if (isRuntimeResponse(response) && response.ok) {
        root.textContent = "Shelf is connected. You can close this tab.";
        return;
      }

      const error =
        isRuntimeResponse(response) && !response.ok ? response.error : "Unable to connect Shelf.";
      root.textContent = error;
    })
    .catch((error: unknown) => {
      root.textContent = error instanceof Error ? error.message : "Unable to connect Shelf.";
    });
};

const isToggleMessage = (
  message: unknown
): message is { previewImageUrl: string | null; type: "shelf:toggle-save-panel" } =>
  typeof message === "object" &&
  message !== null &&
  "type" in message &&
  message.type === "shelf:toggle-save-panel";

const isRuntimeResponse = (
  value: unknown
): value is { ok: true; value: unknown } | { ok: false; error: string } =>
  typeof value === "object" && value !== null && "ok" in value;

const readActivePage = (previewImageUrl: string | null): ActivePage => {
  const title = readMeta(["meta[property='og:title']", "meta[name='twitter:title']"]) || document.title;
  const description =
    readMeta([
      "meta[name='description']",
      "meta[property='og:description']",
      "meta[name='twitter:description']"
    ]) ?? "";
  const imageUrl = resolvePageAsset(
    readMeta(["meta[property='og:image']", "meta[name='twitter:image']", "meta[name='thumbnail']"])
  );
  const faviconUrl = resolvePageAsset(
    document.querySelector<HTMLLinkElement>(
      "link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']"
    )?.href ?? "/favicon.ico"
  );

  return {
    description: description.trim(),
    faviconUrl,
    imageUrl: previewImageUrl ?? imageUrl,
    title: title.trim() || new URL(location.href).hostname,
    url: location.href
  };
};

const readMeta = (selectors: string[]) => {
  for (const selector of selectors) {
    const content = document.querySelector<HTMLMetaElement>(selector)?.content?.trim();

    if (content) {
      return content;
    }
  }

  return null;
};

const resolvePageAsset = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, location.href);

    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};
