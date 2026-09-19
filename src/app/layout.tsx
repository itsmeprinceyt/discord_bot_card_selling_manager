import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import Navbar from "./(components)/Navbar/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://discordbotcardsellingmanager.vercel.app";

const siteDescription =
  "A manual organization system for Discord in-game bot cards. Keep your card collection tidy, track what you owe, and manage your cards for selling — all in one clean, easy-to-use dashboard.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Discord Bot Card Selling Manager",
    template: "%s | Discord Bot Card Selling Manager",
  },
  description: siteDescription,
  keywords: [
    "Discord bot cards",
    "in-game cards",
    "card collection manager",
    "card organizer",
    "Discord card selling",
    "card inventory tracker",
    "manual card organization",
    "Discord trading cards",
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
    url: siteUrl,
    siteName: "Discord Bot Card Selling Manager",
    title: "Discord Bot Card Selling Manager",
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: "Discord Bot Card Selling Manager",
    description: siteDescription,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div>Loading...</div>}>
          <Navbar />
          {children}

          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: "#171717",
                color: "#f5f5f5",
                border: "1px solid #262626",
                fontSize: "14px",
                borderRadius: "10px",
                padding: "10px 14px",
              },
              success: {
                iconTheme: {
                  primary: "#10b981",
                  secondary: "#171717",
                },
              },
              error: {
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#171717",
                },
              },
            }}
          />
        </Suspense>
      </body>
    </html>
  );
}
