import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Discord Bot Card Selling Manager",
    template: "%s | Discord Bot Card Selling Manager",
  },
  description:
    "Manage and sell digital cards effortlessly with Discord Bot Card Selling Manager. Automate orders, track inventory, and streamline your card-selling business directly on Discord.",
  keywords: [
    "Discord bot",
    "card selling",
    "card manager",
    "digital cards",
    "Discord bot manager",
    "sell cards on Discord",
    "inventory management",
    "Discord automation",
  ],
  authors: [
    { name: "www.itsmeprince.com", url: "https://www.itsmeprince.com" },
  ],
  creator: "www.itsmeprince.com",
  publisher: "www.itsmeprince.com",
  applicationName: "Discord Bot Card Selling Manager",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Discord Bot Card Selling Manager",
    title: "Discord Bot Card Selling Manager",
    description:
      "Manage and sell digital cards effortlessly with Discord Bot Card Selling Manager. Automate orders, track inventory, and streamline your card-selling business directly on Discord.",
  },
  twitter: {
    card: "summary",
    title: "Discord Bot Card Selling Manager",
    description:
      "Manage and sell digital cards effortlessly with Discord Bot Card Selling Manager. Automate orders, track inventory, and streamline your card-selling business directly on Discord.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
