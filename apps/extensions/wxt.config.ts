import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Bookmarks",
    description: "Save the current page to Bookmarks.",
    permissions: ["activeTab", "storage", "tabs"],
    host_permissions: ["http://*/*", "https://*/*"],
    action: {
      default_title: "Save to Bookmarks"
    }
  }
});
