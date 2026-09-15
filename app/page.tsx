import OrderDocumentsClient from "./order-documents-client";
import { requireChatGPTUser } from "./chatgpt-auth";

export default async function Home() {
  await requireChatGPTUser("/");
  return <OrderDocumentsClient />;
}
