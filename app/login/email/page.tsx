import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { preAuthChallenge, sessionIsValid } from "@/lib/deployment-access";
import EmailClient from "./email-client";

export const metadata: Metadata = { title: "تأكيد البريد الإلكتروني | blontix", description: "أكد البريد المرتبط بحسابك لإكمال الدخول إلى blontix.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function AdminEmailPage() {
  const request = new Request("https://blontix.internal/login/email", { headers: await headers() });
  if (await sessionIsValid(request)) redirect("/");
  if (!await preAuthChallenge(request)) redirect("/login");
  return <EmailClient />;
}
