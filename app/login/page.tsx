import type { Metadata } from "next";
import LoginClient from "./login-client";

export const metadata: Metadata = { title: "رمز تفعيل اللوحة | blontix", description: "فعّل مفتاحك الرقمي لتفعيل حسابك في blontix.", robots: { index: false, follow: false } };
export default function LoginPage() { return <LoginClient />; }
