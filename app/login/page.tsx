import type { Metadata } from "next";
import LoginClient from "./login-client";

export const metadata: Metadata = { title: "تسجيل الدخول | blontix", robots: { index: false, follow: false } };
export default function LoginPage() { return <LoginClient />; }
