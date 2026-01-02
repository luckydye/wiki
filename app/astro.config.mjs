// @ts-check

import node from "@astrojs/node";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { config } from "./src/config";

const appConfig = config();

// https://astro.build/config
export default defineConfig({
  output: "server",

  site: appConfig.SITE_URL,

  devToolbar: {
    enabled: false,
  },

  vite: {
    plugins: [
      //
      tailwindcss(),
    ],
    envPrefix: "WIKI_",
  },

  i18n: {
    defaultLocale: "en",
    locales: ["de", "en"],
  },

  integrations: [
    vue({
      appEntrypoint: "/src/app.ts",
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.includes("-"),
        },
      },
    }),
  ],

  adapter: node({
    mode: "middleware",
  }),
});
