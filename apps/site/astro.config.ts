import { defineConfig, fontProviders } from "astro/config";

export default defineConfig({
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Open Sans",
      cssVariable: "--font-open-sans",
      options: {
        variants: [
          {
            src: ["@fontsource/open-sans/files/open-sans-latin-300-normal.woff2"],
            weight: "300",
            style: "normal",
          },
          {
            src: ["@fontsource/open-sans/files/open-sans-latin-400-normal.woff2"],
            weight: "400",
            style: "normal",
          },
          {
            src: ["@fontsource/open-sans/files/open-sans-latin-400-italic.woff2"],
            weight: "400",
            style: "italic",
          },
          {
            src: ["@fontsource/open-sans/files/open-sans-latin-500-normal.woff2"],
            weight: "500",
            style: "normal",
          },
          {
            src: ["@fontsource/open-sans/files/open-sans-latin-600-normal.woff2"],
            weight: "600",
            style: "normal",
          },
          {
            src: ["@fontsource/open-sans/files/open-sans-latin-700-normal.woff2"],
            weight: "700",
            style: "normal",
          },
          {
            src: ["@fontsource/open-sans/files/open-sans-latin-800-normal.woff2"],
            weight: "800",
            style: "normal",
          },
        ],
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 4321,
  },
});
