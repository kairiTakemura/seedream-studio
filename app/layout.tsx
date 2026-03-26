import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seedream Studio — AI Image Generator",
  description:
    "Generate stunning images with Seedream 4.5. Upload references, choose your style, and create.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: '"DM Sans", system-ui, sans-serif',
              borderRadius: "12px",
            },
          }}
        />
      </body>
    </html>
  );
}
