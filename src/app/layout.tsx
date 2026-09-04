import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// General Sans (Fontshare, self-hosted — Fontshare's CDN isn't on the CSP
// allowlist in next.config.ts, so the woff2 files live in src/fonts and
// ship from our own origin instead). Replaces Geist Sans as the site's
// primary UI font — Geist Sans was loaded but never actually wired up
// (globals.css's `--font-sans` referenced itself rather than the Geist
// variable, so every page was quietly rendering in each OS's default UI
// font this whole time). See globals.css for the `--font-sans` fix.
const generalSans = localFont({
  src: [
    { path: "../fonts/general-sans/GeneralSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/general-sans/GeneralSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/general-sans/GeneralSans-Semibold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/general-sans/GeneralSans-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-general-sans",
  display: "swap",
});

// Gambetta (Fontshare, self-hosted for the same CSP reason as General Sans
// above) — pairs with General Sans as the site's body-copy serif. Body text
// (paragraphs, labels, descriptions) reads in Gambetta; headings and
// buttons stay on General Sans (see globals.css's `--font-sans` /
// `--font-serif` split, and the explicit `font-sans` overrides added to
// headings/buttons across components). Single variable-weight file covers
// 300–700 in both roman and italic, so regular/medium/bold/emphasis in
// rendered markdown all come from these two files.
const gambetta = localFont({
  src: [
    { path: "../fonts/gambetta/Gambetta-Variable.woff2", weight: "300 700", style: "normal" },
    { path: "../fonts/gambetta/Gambetta-VariableItalic.woff2", weight: "300 700", style: "italic" },
  ],
  variable: "--font-gambetta",
  display: "swap",
});

// Pilcrow Rounded (Fontshare, same self-hosting reason as above) — used
// only for each clip card's filename/title heading (clip-card.module.css
// `.title`), at its Heavy (900) weight, per request. Single variable file
// covers 400-900; only weight 900 is actually used today.
const pilcrowRounded = localFont({
  src: [
    { path: "../fonts/pilcrow-rounded/PilcrowRounded-Variable.woff2", weight: "400 900", style: "normal" },
  ],
  variable: "--font-pilcrow-rounded",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClipClap",
  description: "Multi-device ClipClap app for secure, organized text storage",
  icons: {
    icon: [
      { url: "/icon-32.png",  sizes: "32x32",   type: "image/png" },
      { url: "/icon-48.png",  sizes: "48x48",   type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/icon-32.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ClipClap",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E4F0FC" },
    { media: "(prefers-color-scheme: dark)", color: "#111820" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${generalSans.variable} ${gambetta.variable} ${pilcrowRounded.variable} ${geistMono.variable} ${instrumentSans.variable} h-full antialiased scroll-smooth`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning here (as on <html> above) is Next.js's
          documented mitigation for browser extensions that inject
          attributes into the DOM before React hydrates (e.g. antivirus/
          tracker-blocker extensions adding bis_skin_checked/bis_register) —
          not a real server/client mismatch in this app's own markup. */}
      <body className="min-h-full flex flex-col overflow-x-hidden" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
