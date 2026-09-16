import type { ReactNode } from "react";

export function AccessFrame({ step, title, subtitle, children }: { step: 1 | 2; title: string; subtitle: string; children: ReactNode }) {
  return <main className="access-page" dir="rtl">
    <div className="access-hero">
      <div className="access-hero-inner">
        <div className="access-brand"><img src="/blontix-logo-v1.png" alt="شعار blontix" /><span>blontix</span></div>
        <h1>دخول منصة blontix</h1>
        <p>فعّل مفتاحك الرقمي لتفعيل حسابك</p>
      </div>
    </div>
    <div className="access-content">
      <section className="access-card" aria-labelledby="access-step-heading">
        <div className="access-step"><span className={step === 1 ? "active" : "done"}>١</span><i /><span className={step === 2 ? "active" : ""}>٢</span></div>
        <h2 id="access-step-heading">{title}</h2>
        <p className="access-subtitle">{subtitle}</p>
        {children}
      </section>
      <p className="access-footnote">دخول آمن · blontix</p>
    </div>
  </main>;
}
