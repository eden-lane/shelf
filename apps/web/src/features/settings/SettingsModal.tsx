import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import type { ConnectedApp } from "@shelf/shared";
import { IconLogout2, IconPlugConnected, IconX } from "@tabler/icons-react";

type SettingsTab = "connected-apps";

const connectedAppTitle = (app: ConnectedApp) => {
  const details = [app.browser, app.platform, app.deviceName].filter(Boolean);

  return details.length > 0 ? `${app.clientName} on ${details.join(" / ")}` : app.clientName;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(value));

const ConnectedAppsPanel = ({
  apps,
  isLoading,
  isRevoking,
  onRevoke
}: {
  apps: ConnectedApp[];
  isLoading: boolean;
  isRevoking: boolean;
  onRevoke: (grantId: string) => void;
}) => (
  <section className="grid gap-3" aria-labelledby="settings-connected-apps-heading">
    <div className="grid gap-1">
      <h3
        className="m-0 text-[15px] leading-6 font-medium text-slate-950"
        id="settings-connected-apps-heading"
      >
        Connected apps
      </h3>
      <p className="m-0 text-sm leading-5 text-gray-500">
        Revoke clients without signing out of this browser.
      </p>
    </div>
    {isLoading ? (
      <p className="m-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
        Loading connected apps
      </p>
    ) : apps.length === 0 ? (
      <p className="m-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
        No connected apps.
      </p>
    ) : (
      <div className="grid gap-2">
        {apps.map((app) => (
          <article
            className="grid gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            key={app.id}
          >
            <div className="min-w-0">
              <h4 className="m-0 truncate text-sm font-medium text-slate-950">
                {connectedAppTitle(app)}
              </h4>
              <p className="m-0 mt-1 text-xs leading-5 text-gray-500">
                {app.scopes.join(", ")} · Connected {formatDate(app.createdAt)}
                {app.lastUsedAt ? ` · Last used ${formatDate(app.lastUsedAt)}` : ""}
              </p>
            </div>
            <button
              className="h-8 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-600 outline-none hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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
  isLoading,
  isOpen,
  isRevoking,
  isSigningOut,
  onClose,
  onRevoke,
  onSignOut
}: {
  apps: ConnectedApp[];
  isLoading: boolean;
  isOpen: boolean;
  isRevoking: boolean;
  isSigningOut: boolean;
  onClose: () => void;
  onRevoke: (grantId: string) => void;
  onSignOut: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("connected-apps");

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-[#101522]/45" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 grid max-h-[min(680px,calc(100dvh-48px))] w-[min(calc(100vw-32px),720px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-[#e4e7ef] bg-white text-[#242833] shadow-[0_24px_80px_rgb(22_28_43_/_0.22)] outline-none">
          <div className="grid gap-1 border-b border-[#e4e7ef] px-5 py-4 pr-14">
            <Dialog.Title className="text-lg leading-[1.25] font-medium">Settings</Dialog.Title>
            <Dialog.Description className="text-sm leading-6 text-[#697080]">
              Manage connected apps and your account.
            </Dialog.Description>
          </div>
          <Dialog.Close
            className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[#697080] outline-none hover:border-[#e4e7ef] hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
            aria-label="Close settings"
            type="button"
          >
            <IconX size={16} stroke={1.5} aria-hidden="true" focusable="false" />
          </Dialog.Close>

          <div className="grid min-h-[360px] grid-cols-[11.5rem_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col border-r border-[#e4e7ef] bg-[#f7f8fc]">
              <nav
                className="grid gap-1 p-2"
                aria-label="Settings sections"
                role="tablist"
                aria-orientation="vertical"
              >
                <button
                  className={[
                    "inline-flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
                    activeTab === "connected-apps"
                      ? "bg-white text-slate-950 shadow-[0_1px_2px_rgb(15_23_42_/_0.06)]"
                      : "text-gray-600 hover:bg-white/70 hover:text-slate-950"
                  ].join(" ")}
                  aria-controls="settings-panel-connected-apps"
                  aria-selected={activeTab === "connected-apps"}
                  id="settings-tab-connected-apps"
                  role="tab"
                  type="button"
                  onClick={() => setActiveTab("connected-apps")}
                >
                  <IconPlugConnected size={16} stroke={1.5} aria-hidden="true" focusable="false" />
                  <span>Connected apps</span>
                </button>
              </nav>
              <div className="mt-auto border-t border-[#e4e7ef] p-2">
                <button
                  className="inline-flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium text-gray-600 outline-none hover:bg-white/70 hover:text-slate-950 disabled:cursor-not-allowed disabled:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                  disabled={isSigningOut}
                  type="button"
                  onClick={onSignOut}
                >
                  <IconLogout2 size={16} stroke={1.5} aria-hidden="true" focusable="false" />
                  <span>{isSigningOut ? "Signing out" : "Sign out"}</span>
                </button>
              </div>
            </aside>

            <div
              className="min-h-0 overflow-y-auto p-5"
              aria-labelledby="settings-tab-connected-apps"
              id="settings-panel-connected-apps"
              role="tabpanel"
            >
              {activeTab === "connected-apps" ? (
                <ConnectedAppsPanel
                  apps={apps}
                  isLoading={isLoading}
                  isRevoking={isRevoking}
                  onRevoke={onRevoke}
                />
              ) : null}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
