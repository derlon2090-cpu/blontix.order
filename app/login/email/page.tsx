import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BackendUnavailableError, preAuthChallenge, sessionIsValid } from "@/lib/deployment-access";
import ServiceUnavailable from "@/app/service-unavailable";
import EmailClient from "./email-client";

export const metadata: Metadata = { title: "تأكيد البريد الإلكتروني | blontix", description: "أكد البريد المرتبط بحسابك لإكمال الدخول إلى blontix.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function AdminEmailPage() {
  const request = new Request("https://blontix.internal/login/email", { headers: await headers() });
  let authenticated,preAuthenticated;
  try{
    authenticated=await sessionIsValid(request);
    preAuthenticated=!authenticated && Boolean(await preAuthChallenge(request));
  }catch(error){
    if(error instanceof BackendUnavailableError)return <ServiceUnavailable />;
    throw error;
  }
  if (authenticated) redirect("/");
  if (!preAuthenticated) redirect("/login");
  return <EmailClient />;
}
