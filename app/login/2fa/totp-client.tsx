"use client";
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Loader2, ShieldCheck} from 'lucide-react';
import {AccessFrame} from '../access-frame';
export default function TotpClient() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || blocked) return;
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/access/2fa', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code}), cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(90000)});
      const data = await response.json() as {ok?: boolean; error?: string; blocked?: boolean};
      if (data.blocked) setBlocked(true);
      if (!response.ok || !data.ok) throw new Error(data.error || 'تعذر تأكيد الرمز.');
      window.location.assign('/');
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'تعذر الاتصال بخدمة الدخول.');}
    finally {setCode(''); setLoading(false);}
  }
  return <AccessFrame step={3} title="المصادقة الثنائية" subtitle="أدخل الرمز الحالي المكوّن من ستة أرقام من تطبيق المصادقة">
    <form onSubmit={submit} className="access-form">
      <Label htmlFor="totp-code">رمز تطبيق المصادقة</Label>
      <Input id="totp-code" type="text" inputMode="numeric" autoComplete="one-time-code" dir="ltr" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/[^0-9]/g, ''))} required disabled={loading || blocked} placeholder="000000" />
      <p className="text-sm text-slate-500">الرمز يتغير كل 30 ثانية ويُستخدم مرة واحدة. اضبط وقت الهاتف تلقائيًا.</p>
      {error && <p role="alert" className="access-alert">{error}</p>}
      <Button type="submit" className="access-submit" disabled={loading || blocked || code.length !== 6}>{loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />} تأكيد والدخول</Button>
      <a href="/login" className="access-back">العودة إلى بداية الدخول</a>
    </form>
  </AccessFrame>;
}
