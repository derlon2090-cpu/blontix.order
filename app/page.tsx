import OrderDocumentsClient from "./order-documents-client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionIsValid } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const request = new Request("https://blontix.internal/", { headers: await headers() });
  if (!await sessionIsValid(request)) redirect("/login");
  return <OrderDocumentsClient />;
}
