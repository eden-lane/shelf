import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Bookmarks",
    description: "Save the current page to Bookmarks.",
    icons: {
      16: "/icons/icon-16.png",
      32: "/icons/icon-32.png",
      48: "/icons/icon-48.png",
      96: "/icons/icon-96.png",
      128: "/icons/icon-128.png",
      256: "/icons/icon-256.png",
      512: "/icons/icon-512.png"
    },
    permissions: ["activeTab", "storage", "tabs"],
    host_permissions: ["http://*/*", "https://*/*"],
    action: {
      default_icon: {
        16: "/icons/icon-16.png",
        32: "/icons/icon-32.png",
        48: "/icons/icon-48.png",
        96: "/icons/icon-96.png",
        128: "/icons/icon-128.png"
      },
      default_title: "Save to Bookmarks"
    }
  }
});
