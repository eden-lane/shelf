import { defineConfig } from "wxt";
import solid from "vite-plugin-solid";

const icons = {
  16: "/icons/icon-16.png",
  32: "/icons/icon-32.png",
  48: "/icons/icon-48.png",
  96: "/icons/icon-96.png",
  128: "/icons/icon-128.png",
  256: "/icons/icon-256.png",
  512: "/icons/icon-512.png"
};

const optionalApiOrigins = ["http://*/*", "https://*/*"];

export default defineConfig({
  vite: () => ({
    plugins: [solid()]
  }),
  manifest: ({ browser }) => ({
    name: "Shelf",
    description: "Save the current page to Shelf.",
    icons,
    permissions:
      browser === "safari" ? ["activeTab", "storage"] : ["activeTab", "identity", "storage"],
    ...(browser === "chrome"
      ? { optional_host_permissions: optionalApiOrigins }
      : { optional_permissions: optionalApiOrigins }),
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
  })
});
