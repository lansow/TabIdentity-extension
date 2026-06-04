import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,

  name: "TabIdentity",

  version: "0.0.1",

  description: "Switch between website identities instantly",

  permissions: ["storage", "cookies", "tabs", "scripting"],

  host_permissions: ["<all_urls>"],

  action: {
    default_popup: "src/popup/index.html",
  },

  background: {
    service_worker: "src/background/background.js",
    type: "module",
  },
});
