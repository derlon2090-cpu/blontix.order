import type { Metadata } from "next";
import VerificationClient from "./verification-client";

export const metadata: Metadata = {
  title: "التحقق من أصالة المستند",
  description: "صفحة رسمية للتحقق من تسجيل مستند الطلب ومطابقته للنسخة الإلكترونية.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function VerificationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <VerificationClient token={token} />;
}
