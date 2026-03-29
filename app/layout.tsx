import type { Metadata } from "next";
import { Geist_Mono, Manrope, Space_Grotesk } from "next/font/google";
import { AppThemeProvider } from "@/src/components/AppThemeProvider";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ET Co-Op | AI Household Money Mentor",
  description:
    "Notion-simple onboarding plus Stripe-grade financial insights for couples.",
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
      className={`${manrope.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
