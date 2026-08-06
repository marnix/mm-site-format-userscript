import { defineConfig } from "vitest/config";

// happy-dom otherwise tries to fetch each fixture's <link> stylesheet (mmset.css)
// -- pointless here, and it spews ECONNREFUSED noise. Turn off resource loading.
//
// The nmulprop fixture test parses 183 HTML files through happy-dom, which
// requires ~5 GB of heap. The default Node.js limit is 2 GB; raise it here so
// CI passes without needing a per-run NODE_OPTIONS wrapper.
export default defineConfig({
  define: {
    // Injects the value read by src/config.ts's DEV_CHECK_SHARED_COVERAGE, so
    // the coverage self-check runs under vitest but stays off in the shipped
    // userscript (tsup.config.ts defines the same constant as "false").
    __TEST_MODE__: "true",
  },
  test: {
    execArgv: ["--max-old-space-size=8192"],
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
