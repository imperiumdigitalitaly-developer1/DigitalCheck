/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F5F1",
        ink: "#14171C",
        "ink-soft": "#3A3F47",
        // Terza sfumatura, piu' tenue, per didascalie e testo secondario
        // della landing (es. "/100" nel gauge, footer): additiva, non
        // sostituisce ink/ink-soft usati altrove.
        "ink-faint": "#8A93A3",
        line: "#E3E0D8",
        "line-strong": "#D7D2C6",
        accent: {
          DEFAULT: "#1F6F64",
          soft: "#E4EFEC",
          deep: "#123F38",
        },
        // Blu del logo DigitalCheck reale (public/logo-transparent.png), usato
        // SOLO nella nuova landing page: "accent" (teal) resta il colore del
        // prodotto autenticato (dashboard, report, PDF) e non va toccato.
        accentBlue: {
          DEFAULT: "#1857D9",
          soft: "#EAF1FE",
          deep: "#0F3FA6",
        },
        severity: {
          high: "#B4483F",
          medium: "#C97A3D",
          low: "#3F7D8F",
        },
        score: {
          critical: "#B4483F",
          weak: "#C97A3D",
          good: "#3F7D8F",
          strong: "#1F6F64",
          excellent: "#2F7A4F",
        },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["IBM Plex Sans", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["IBM Plex Mono", "SFMono-Regular", "Menlo", "monospace"],
      },
      maxWidth: {
        prose: "68ch",
      },
      // Comparsa leggera delle sezioni della landing al caricamento (brief
      // redesign landing: "animazioni leggere... comparsa delle sezioni").
      // globals.css azzera gia' animation-duration sotto prefers-reduced-motion.
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.7s cubic-bezier(0.16,0.8,0.3,1) both",
      },
    },
  },
  plugins: [],
};
