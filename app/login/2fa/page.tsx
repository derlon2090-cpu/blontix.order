import type {Metadata} from 'next';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {BackendUnavailableError, preAuthChallenge, sessionIsValid} from '@/lib/deployment-access';
import ServiceUnavailable from '@/app/service-unavailable';
import TotpClient from './totp-client';
export const metadata: Metadata = {title: 'المصادقة الثنائية | blontix', robots: {index: false, follow: false}};
export const dynamic = 'force-dynamic';
export default async function TotpPage() {
  const request = new Request('https://blontix.internal/login/2fa', {headers: await headers()});
  try {
    if (await sessionIsValid(request)) redirect('/');
    if (!await preAuthChallenge(request)) redirect('/login');
  } catch (error) {
    if (error instanceof BackendUnavailableError) return <ServiceUnavailable />;
    throw error;
  }
  return <TotpClient />;
}
