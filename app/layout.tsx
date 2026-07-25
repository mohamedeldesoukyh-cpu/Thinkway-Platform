import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: {
    default: "Thinkway Platform",
    template: "%s · Thinkway",
  },
  description: "Enterprise influencer marketing operations platform",
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
      </head>
      <body
        suppressHydrationWarning
        className="flex min-h-full flex-col bg-background text-foreground"
      >
        <AppProviders>
          <EnvironmentBannerSlot />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
