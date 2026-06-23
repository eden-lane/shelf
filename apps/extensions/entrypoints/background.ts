import { browser } from "wxt/browser";
import { rpcCall } from "../lib/rpc";
import { getApiBaseUrl, hasApiBaseUrlPermission } from "../lib/settings";

type ExtensionMessage =
  | {
      type: "shelf:open-options";
    }
  | {
      input: unknown;
      path: string;
      type: "shelf:rpc";
    };

export default defineBackground(() => {
  const toolbarAction = browser.action ?? browser.browserAction;

  toolbarAction.onClicked.addListener((tab) => {
    if (!tab.id || !tab.url || !/^https?:\/\//.test(tab.url)) {
      void browser.runtime.openOptionsPage();
      return;
    }

    void togglePanelInTab(tab.id, tab.windowId);
  });

  browser.runtime.onMessage.addListener((message: ExtensionMessage) => {
    if (message?.type === "shelf:open-options") {
      void browser.runtime.openOptionsPage();
      return undefined;
    }

    if (message?.type !== "shelf:rpc") {
      return undefined;
    }

    return callShelfApi(message.path, message.input);
  });
});

const callShelfApi = async (path: string, input: unknown) => {
  const apiUrl = await getApiBaseUrl();

  if (!(await hasApiBaseUrlPermission(apiUrl))) {
    throw new Error("Open Settings and test the API URL to grant Shelf access.");
  }

  return rpcCall(apiUrl, path, input);
};

const togglePanelInTab = async (tabId: number, windowId: number) => {
  const previewImageUrl = await browser.tabs
    .captureVisibleTab(windowId, { format: "jpeg", quality: 45 })
    .catch(() => null);

  await browser.tabs
    .sendMessage(tabId, {
      previewImageUrl,
      type: "shelf:toggle-save-panel"
    })
    .catch(() => {
      // Restricted pages can fail to receive content-script messages.
    });
};
