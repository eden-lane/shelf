import { Dialog } from "@base-ui/react/dialog";
import type { ConnectedApp, FolderItem, TagItem } from "@shelf/shared";
import { IconDeviceDesktop, IconLogout2, IconPlugConnected, IconX } from "@tabler/icons-react";
import { useState } from "react";
import IntegrationsPanel from "./IntegrationsPanel";

type SettingsTab = "connected-apps" | "integrations";

const connectedAppTitle = (app: ConnectedApp) => {
  const details = [app.browser, app.platform, app.deviceName].filter(Boolean);
  return details.length > 0 ? `${app.clientName} on ${details.join(" / ")}` : app.clientName;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));

const ConnectedAppsPanel = ({
  apps,
  isLoading,
  isRevoking,
  onRevoke,
}: {
  apps: ConnectedApp[];
  isLoading: boolean;
  isRevoking: boolean;
  onRevoke: (grantId: string) => void;
}) => (
  <section className="grid gap-4" aria-labelledby="settings-connected-apps-heading">
    <p className="m-0 text-sm leading-5 text-[#697080]" id="settings-connected-apps-heading">
      These clients have access to your account. Revoke any you don't recognize.
    </p>
    {isLoading ? (
      <div className="flex items-center gap-2.5 rounded-lg bg-[#f7f9fc] px-3.5 py-3 text-sm text-[#697080]">
        <span
          className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[#dfe4ef] border-t-[#3b8df5]"
          aria-hidden="true"
        />
        Loading…
      </div>
    ) : apps.length === 0 ? (
      <div className="grid place-items-center gap-2.5 rounded-xl bg-[#f7f9fc] py-10">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0f3f9] text-[#9ba4b4]">
          <IconDeviceDesktop size={20} stroke={1.5} aria-hidden="true" />
        </div>
        <div className="text-center">
          <p className="m-0 text-sm font-medium text-[#242833]">No connected apps</p>
          <p className="m-0 mt-0.5 text-xs text-[#697080]">Authorized clients will appear here.</p>
        </div>
      </div>
    ) : (
      <div className="grid gap-2">
        {apps.map((app) => (
          <article
            key={app.id}
            className="flex items-center gap-3 rounded-xl bg-[#f7f9fc] px-4 py-3"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f0f3f9] text-[#697080]">
              <IconDeviceDesktop size={18} stroke={1.5} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-sm font-medium text-[#242833]">
                {connectedAppTitle(app)}
              </p>
              <p className="m-0 mt-0.5 text-xs text-[#697080]">
                {app.scopes.join(", ")} · Connected {formatDate(app.createdAt)}
                {app.lastUsedAt ? ` · Last used ${formatDate(app.lastUsedAt)}` : ""}
              </p>
            </div>
            <button
              className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 outline-none hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
              disabled={isRevoking}
              type="button"
              onClick={() => onRevoke(app.id)}
            >
              Revoke
            </button>
          </article>
        ))}
      </div>
    )}
  </section>
);

export const SettingsModal = ({
  apps,
  folders,
  isLoading,
  isOpen,
  isRevoking,
  isSigningOut,
  tags,
  onClose,
  onRefreshLibraryItems,
  onRevoke,
  onSignOut,
}: {
  apps: ConnectedApp[];
  folders: FolderItem[];
  isLoading: boolean;
  isOpen: boolean;
  isRevoking: boolean;
  isSigningOut: boolean;
  tags: TagItem[];
  onClose: () => void;
  onRefreshLibraryItems: () => void;
  onRevoke: (grantId: string) => void;
  onSignOut: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("connected-apps");

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-[#101522]/45" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex h-[min(760px,calc(100dvh-48px))] w-[min(calc(100vw-32px),980px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white text-[#242833] shadow-[0_24px_80px_rgb(22_28_43_/_0.22)] outline-none">
          <div className="flex shrink-0 items-center justify-between px-6 py-5">
            <Dialog.Title className="text-[15px] font-semibold text-slate-950">
              Settings
            </Dialog.Title>
            <Dialog.Close
              className="grid h-8 w-8 place-items-center rounded-lg text-[#697080] outline-none hover:bg-[#f4f6fa] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
              aria-label="Close"
              type="button"
            >
              <IconX size={15} stroke={2} aria-hidden="true" focusable="false" />
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1">
            <aside className="flex w-52 shrink-0 flex-col bg-white py-2">
              <div
                className="grid gap-1 px-3"
                role="tablist"
                aria-orientation="vertical"
                aria-label="Settings sections"
              >
                <button
                  className={[
                    "inline-flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
                    activeTab === "connected-apps"
                      ? "bg-[#f2f6fb] text-[#242833]"
                      : "text-[#697080] hover:bg-[#f7f9fc] hover:text-[#242833]",
                  ].join(" ")}
                  aria-controls="settings-panel-connected-apps"
                  aria-selected={activeTab === "connected-apps"}
                  id="settings-tab-connected-apps"
                  role="tab"
                  type="button"
                  onClick={() => setActiveTab("connected-apps")}
                >
                  <IconDeviceDesktop size={15} stroke={1.75} aria-hidden="true" focusable="false" />
                  Connected apps
                </button>

                <button
                  className={[
                    "inline-flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
                    activeTab === "integrations"
                      ? "bg-[#f2f6fb] text-[#242833]"
                      : "text-[#697080] hover:bg-[#f7f9fc] hover:text-[#242833]",
                  ].join(" ")}
                  aria-controls="settings-panel-integrations"
                  aria-selected={activeTab === "integrations"}
                  id="settings-tab-integrations"
                  role="tab"
                  type="button"
                  onClick={() => {
                    onRefreshLibraryItems();
                    setActiveTab("integrations");
                  }}
                >
                  <IconPlugConnected size={15} stroke={1.75} aria-hidden="true" focusable="false" />
                  Integrations
                </button>
              </div>

              <div className="mt-auto px-3 pt-2">
                <button
                  className="inline-flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium text-[#697080] outline-none transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                  disabled={isSigningOut}
                  type="button"
                  onClick={onSignOut}
                >
                  <IconLogout2 size={15} stroke={1.75} aria-hidden="true" focusable="false" />
                  {isSigningOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </aside>

            <div
              className="min-h-0 flex-1 overflow-y-auto bg-white px-6 pb-6 pt-2"
              aria-labelledby={
                activeTab === "connected-apps"
                  ? "settings-tab-connected-apps"
                  : "settings-tab-integrations"
              }
              id={
                activeTab === "connected-apps"
                  ? "settings-panel-connected-apps"
                  : "settings-panel-integrations"
              }
              role="tabpanel"
            >
              {activeTab === "connected-apps" && (
                <ConnectedAppsPanel
                  apps={apps}
                  isLoading={isLoading}
                  isRevoking={isRevoking}
                  onRevoke={onRevoke}
                />
              )}
              {activeTab === "integrations" && (
                <IntegrationsPanel
                  folders={folders}
                  tags={tags}
                  onRefreshLibraryItems={onRefreshLibraryItems}
                />
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
