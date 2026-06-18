import { defineConfig } from "vitest/config";

// happy-dom otherwise tries to fetch each fixture's <link> stylesheet (mmset.css)
// -- pointless here, and it spews ECONNREFUSED noise. Turn off resource loading.
export default defineConfig({
  test: {
    environmentOptions: {
      happyDOM: {
        settings: {
          disableCSSFileLoading: true,
          disableJavaScriptFileLoading: true,
          disableComputedStyleRendering: true,
        },
      },
    },
  },
});
