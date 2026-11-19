export const dynamic = 'force-dynamic';
import { Forgot } from '@gitroom/frontend/components/auth/forgot';
import { SupabaseLogin } from '@gitroom/frontend/components/auth/supabase.login';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Forgot Password`,
  description: '',
};
export default async function Auth() {
  if (process.env.AUTH_PROVIDER === 'supabase') return <SupabaseLogin mode="forgot" />;
  return <Forgot />;
}
