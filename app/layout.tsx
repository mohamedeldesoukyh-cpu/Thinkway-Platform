import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { EnvironmentBannerSlot } from "@/components/environment/environment-banner-slot";
import { AppProviders } from "@/components/providers/app-providers";
import { ThemeHeadScript } from "@/lib/theme/theme-head-script";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const APP_NAME = "Thinkway Platform";
const APP_DESCRIPTION =
  "AI-powered Influencer Discovery, Campaign Intelligence and Creator Relationship Management Platform.";

function resolveMetadataBase(): URL {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_PRODUCTION_APP_URL?.trim() ||
    "https://app.thinkwaymedia.com";
  try {
    return new URL(raw);
  } catch {
    return new URL("https://app.thinkwaymedia.com");
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: APP_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ["/twitter-card.png"],
  },
  other: {
    "msapplication-TileImage": "/mstile-150x150.png",
    "msapplication-TileColor": "#090B14",
    "msapplication-config": "/browserconfig.xml",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#090B14" },
    { media: "(prefers-color-scheme: dark)", color: "#090B14" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased font-sans",
        geistSans.variable,
        geistMono.variable
      )}
    >
      <head>
        <ThemeHeadScript />
        {/* iOS PWA splash screens (brand kit) */}
        <link
          rel="apple-touch-startup-image"
          href="/splash-2048x2732.png"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash-1668x2388.png"
          media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash-1536x2048.png"
          media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
      </head>
      <body
        suppressHydrationWarning
        className="flex h-svh max-h-svh flex-col overflow-hidden bg-background text-foreground"
      >
        <div id="pwa-splash" aria-hidden="true">
          {/* Splash must paint before hydration; next/image is unsuitable here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-512x512.png"
            alt=""
            width={96}
            height={96}
            decoding="async"
          />
        </div>
        <AppProviders>
          <EnvironmentBannerSlot />
          {/*
            Banner is shrink-0 above this region. App shells must use h-full/min-h-0
            (not 100svh) so campaign chrome never slides under the orange bar.
          */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {children}
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
