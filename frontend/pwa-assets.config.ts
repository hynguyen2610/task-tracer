import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Generates every app icon from public/logo.svg: npm run icons
// (docs/SPEC.md 13). The maskable and Apple icons get a solid background,
// since Android crops maskable icons and iOS turns transparency black.
export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.3, resizeOptions: { background: "#4f46e5" } },
    apple: { ...minimal2023Preset.apple, padding: 0.15, resizeOptions: { background: "#4f46e5" } },
  },
  images: ["public/logo.svg"],
});
