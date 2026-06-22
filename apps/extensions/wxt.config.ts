import { defineConfig } from "wxt";
import solid from "vite-plugin-solid";

export default defineConfig({
  vite: () => ({
    plugins: [solid()]
  }),
  manifest: {
    name: "Shelf",
    description: "Save the current page to Shelf.",
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
      default_title: "Save to Shelf"
    }
  }
});
