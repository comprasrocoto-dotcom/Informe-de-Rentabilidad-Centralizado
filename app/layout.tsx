import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Informe de Rentabilidad",
  description: "Rentabilidad centralizada por marca y sede",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
