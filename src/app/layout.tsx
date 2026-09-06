import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// No font loading here on purpose. General Sans / Gambetta / Pilcrow
// Rounded / Geist Mono are dashboard-only, and Instrument Sans is
// login-only — declaring them all here (as this file used to) meant
// every route downloaded all 9 font files regardless of whether it used
// any of them, including the login page loading ~236KB of dashboard
// fonts it never renders a single character in. Each group is now loaded
// in the layout/page that actually uses it: see (dashboard)/layout.tsx
// and (auth)/login/page.tsx.

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
      className="h-full antialiased scroll-smooth"
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
