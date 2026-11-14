/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,tsx}"],
  theme: {
    extend: {
      // Bottom sheets on the phone layout slide up (docs/SPEC.md 14).
      keyframes: {
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
      },
      animation: { "sheet-up": "sheet-up 180ms ease-out" },
    },
  },
  plugins: [],
};

