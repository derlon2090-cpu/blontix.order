import OrderDocumentsClient from "./order-documents-client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BackendUnavailableError, sessionIsValid } from "@/lib/deployment-access";
import ServiceUnavailable from "./service-unavailable";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function Home() {
  const request = new Request("https://blontix.internal/", { headers: await headers() });
  let authenticated;
  try{authenticated=await sessionIsValid(request);}catch(error){
    if(error instanceof BackendUnavailableError)return <ServiceUnavailable />;
    throw error;
  }
  if (!authenticated) redirect("/login");
  return <OrderDocumentsClient />;
}
