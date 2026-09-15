import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مستندات توثيق الطلبات",
  description: "إنشاء وحفظ مستندات PDF قانونية ثابتة لتوثيق الطلبات الرقمية.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body className="antialiased">{children}</body></html>;
}
