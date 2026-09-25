import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { site } from "@/config/site";
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "KadiYangu — Bring your people together",
    template: "%s | KadiYangu",
  },
  description: site.description,
  icons: { icon: "/icon.svg" },
  robots: { index: site.indexable, follow: site.indexable },
  openGraph: {
    title: "KadiYangu",
    description: site.description,
    type: "website",
    siteName: site.name,
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:p-4">
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
