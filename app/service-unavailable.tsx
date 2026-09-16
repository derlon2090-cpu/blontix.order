"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AccessFrame } from "./login/access-frame";

export default function ServiceUnavailable(){
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  return <AccessFrame step={1} title="تعذر الاتصال بالمنصة مؤقتًا" subtitle="قد تستغرق الخدمة نحو دقيقة للاستيقاظ. انتظر قليلًا ثم أعد المحاولة.">
    <p role="status" className="access-alert">تظل جلسة الدخول محفوظة. لم يُحتسب تعذر الاتصال محاولة دخول خاطئة.</p>
    <Button className="access-submit" disabled={pending} onClick={()=>startTransition(()=>router.refresh())}>{pending ? "جارٍ الاتصال…" : "إعادة المحاولة"}</Button>
  </AccessFrame>;
}
