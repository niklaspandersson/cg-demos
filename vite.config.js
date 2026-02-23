import { build } from "vite";
import dynamicImport from "vite-plugin-dynamic-import";

export default {
  assetIncludes: ["**/*.glsl"],
  plugins: [dynamicImport()],
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: "./index.html",
        main2: "./index2.html",
      },
    },
  },
};
