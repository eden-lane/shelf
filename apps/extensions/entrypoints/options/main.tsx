import "./style.css";
import { createSignal, onMount } from "solid-js";
import { render } from "solid-js/web";
import { rpcCall } from "../../lib/rpc";
import { defaultApiUrl, getApiBaseUrl, saveApiBaseUrl } from "../../lib/settings";

interface CurrentUserResponse {
  libraries: Array<{
    id: string;
    kind: "personal" | "organization";
    name: string;
  }>;
}

type MessageTone = "error" | "neutral" | "success";

const App = () => {
  const [apiUrl, setApiUrl] = createSignal("");
  const [isBusy, setIsBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [messageTone, setMessageTone] = createSignal<MessageTone>("neutral");

  onMount(async () => {
    setApiUrl(await getApiBaseUrl());
  });

  const saveSettings = async () => {
    setIsBusy(true);

    try {
      const normalizedApiUrl = await saveApiBaseUrl(apiUrl());
      setApiUrl(normalizedApiUrl);
      writeMessage("Saved", "success");
    } catch (error) {
      writeMessage(errorMessage(error), "error");
    } finally {
      setIsBusy(false);
    }
  };

  const testConnection = async () => {
    setIsBusy(true);
    writeMessage("Testing", "neutral");

    try {
      const normalizedApiUrl = await saveApiBaseUrl(apiUrl());
      setApiUrl(normalizedApiUrl);
      await rpcCall<CurrentUserResponse>(normalizedApiUrl, "currentUser", undefined);
      writeMessage("Connected", "success");
    } catch (error) {
      writeMessage(errorMessage(error), "error");
    } finally {
      setIsBusy(false);
    }
  };

  const resetSettings = async () => {
    setApiUrl(defaultApiUrl);
    setIsBusy(true);

    try {
      const normalizedApiUrl = await saveApiBaseUrl(defaultApiUrl);
      setApiUrl(normalizedApiUrl);
      writeMessage("Saved", "success");
    } catch (error) {
      writeMessage(errorMessage(error), "error");
    } finally {
      setIsBusy(false);
    }
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
          <span>API URL</span>
          <input
            name="apiUrl"
            type="url"
            autocomplete="url"
            spellcheck={false}
            required
            value={apiUrl()}
            disabled={isBusy()}
            onInput={(event) => setApiUrl(event.currentTarget.value)}
          />
        </label>

        <p class="message" data-tone={messageTone()} role="status">
          {message()}
        </p>

        <div class="button-row">
          <button class="primary-button" type="submit" disabled={isBusy()}>
            Save
          </button>
          <button class="secondary-button" type="button" disabled={isBusy()} onClick={() => void testConnection()}>
            Test
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

const root = document.querySelector("#root");

if (!root) {
  throw new Error("Missing root element");
}

render(() => <App />, root);
