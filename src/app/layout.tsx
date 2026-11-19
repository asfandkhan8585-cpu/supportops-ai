import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { ThemeInit } from "@/components/theme-init";
import "./globals.css";

export const metadata: Metadata = {
  title: "SupportOps AI | NovaCart",
  description: "Customer support workspace for NovaCart",
  icons: {
    icon: "/supportops.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full">
        <Providers>
          <ThemeInit />
          {children}
        </Providers>
      </body>
    </html>
  );
}
