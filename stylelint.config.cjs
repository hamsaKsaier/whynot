/** @type {import('stylelint').Config} */
module.exports = {
  extends: [
    "stylelint-config-standard",
    "stylelint-config-recess-order",
  ],
  rules: {
    "color-no-hex": true,
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: ["tailwind", "apply", "layer", "config", "screen"],
      },
    ],
    "function-no-unknown": [
      true,
      {
        ignoreFunctions: ["theme", "oklch", "var"],
      },
    ],
    "no-descending-specificity": null,
    "selector-class-pattern": null,
  },
  overrides: [
    {
      files: ["**/tailwind.config.ts", "**/tailwind.config.js"],
      rules: {
        "color-no-hex": null,
      },
    },
  ],
  ignoreFiles: [
    "node_modules/**",
    "dist/**",
    "coverage/**",
    "**/tailwind.config.*",
  ],
}
