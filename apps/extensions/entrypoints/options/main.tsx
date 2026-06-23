import "./style.css";
import { createSignal, onMount } from "solid-js";
import { render } from "solid-js/web";
import { browser } from "wxt/browser";
import {
  defaultShelfInstanceUrl,
  getShelfInstanceUrl,
  saveShelfInstanceUrl
} from "../../lib/settings";

type MessageTone = "error" | "neutral" | "success";

const App = () => {
  const [instanceUrl, setInstanceUrl] = createSignal("");
  const [isConnected, setIsConnected] = createSignal(false);
  const [isBusy, setIsBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [messageTone, setMessageTone] = createSignal<MessageTone>("neutral");

  onMount(async () => {
    await loadConnection();
  });

  const saveSettings = async () => {
    setIsBusy(true);

    try {
      const normalizedInstanceUrl = await saveShelfInstanceUrl(instanceUrl());
      setInstanceUrl(normalizedInstanceUrl);
      writeMessage("Saved", "success");
    } catch (error) {
      writeMessage(errorMessage(error), "error");
    } finally {
      setIsBusy(false);
    }
  };

  const connect = async () => {
    setIsBusy(true);
    writeMessage("Connecting", "neutral");

    try {
      const normalizedInstanceUrl = await saveShelfInstanceUrl(instanceUrl());
      setInstanceUrl(normalizedInstanceUrl);
      const response = await sendRuntimeMessage<{ instanceUrl: string; connected: boolean }>({
        type: "shelf:connect",
        instanceUrl: normalizedInstanceUrl
      });
      setInstanceUrl(response.instanceUrl);
      setIsConnected(response.connected);
      writeMessage("Connected", "success");
    } catch (error) {
      writeMessage(errorMessage(error), "error");
    } finally {
      setIsBusy(false);
    }
  };

  const disconnect = async () => {
    setIsBusy(true);

    try {
      const response = await sendRuntimeMessage<{ instanceUrl: string; connected: boolean }>({
        type: "shelf:disconnect"
      });
      setInstanceUrl(response.instanceUrl);
      setIsConnected(response.connected);
      writeMessage("Disconnected", "success");
    } catch (error) {
      writeMessage(errorMessage(error), "error");
    } finally {
      setIsBusy(false);
    }
  };

  const resetSettings = async () => {
    setInstanceUrl(defaultShelfInstanceUrl);
    setIsBusy(true);

    try {
      const normalizedInstanceUrl = await saveShelfInstanceUrl(defaultShelfInstanceUrl);
      setInstanceUrl(normalizedInstanceUrl);
      writeMessage("Saved", "success");
    } catch (error) {
      writeMessage(errorMessage(error), "error");
    } finally {
      setIsBusy(false);
    }
  };

  const loadConnection = async () => {
    const response = await sendRuntimeMessage<{ instanceUrl: string; connected: boolean }>({
      type: "shelf:getConnection"
    }).catch(async () => ({
      instanceUrl: await getShelfInstanceUrl(),
      connected: false
    }));

    setInstanceUrl(response.instanceUrl);
    setIsConnected(response.connected);
  };

  const writeMessage = (text: string, tone: MessageTone) => {
    setMessage(text);
    setMessageTone(tone);
  };

  return (
    <main class="settings-shell">
      <header class="settings-header">
        <p class="eyebrow">Shelf</p>
        <h1>Settings</h1>
      </header>

      <form
        class="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          void saveSettings();
        }}
      >
        <label class="field">
          <span>Shelf instance</span>
          <input
            name="instanceUrl"
            type="url"
            autocomplete="url"
            spellcheck={false}
            required
            value={instanceUrl()}
            disabled={isBusy()}
            onInput={(event) => setInstanceUrl(event.currentTarget.value)}
          />
        </label>

        <p class="message" data-tone={messageTone()} role="status">
          {message()}
        </p>

        <div class="button-row">
          <button class="primary-button" type="submit" disabled={isBusy()}>
            Save
          </button>
          <button class="secondary-button" type="button" disabled={isBusy()} onClick={() => void connect()}>
            {isConnected() ? "Reconnect" : "Connect"}
          </button>
          <button class="secondary-button" type="button" disabled={isBusy() || !isConnected()} onClick={() => void disconnect()}>
            Disconnect
          </button>
          <button class="secondary-button" type="button" disabled={isBusy()} onClick={() => void resetSettings()}>
            Reset
          </button>
        </div>
      </form>
    </main>
  );
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to connect to Shelf";

const sendRuntimeMessage = async <T,>(message: Record<string, unknown>): Promise<T> => {
  const response = await browser.runtime.sendMessage(message);

  if (
    !response ||
    typeof response !== "object" ||
    !("ok" in response) ||
    typeof response.ok !== "boolean"
  ) {
    throw new Error("Shelf extension background is not available.");
  }

  if (!response.ok) {
    const error = "error" in response && typeof response.error === "string" ? response.error : null;

    throw new Error(error ?? "Shelf request failed.");
  }

  return response.value as T;
};

const root = document.querySelector("#root");

if (!root) {
  throw new Error("Missing root element");
}

render(() => <App />, root);
