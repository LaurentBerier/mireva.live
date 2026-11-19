import { cookies } from 'next/headers';
import { customFetch } from '@gitroom/helpers/utils/custom.fetch.func';
import { backendInternalUrl } from './backend.internal.url';

export const internalFetch = async (url: string, options: RequestInit = {}) => {
  const cookieStore = await cookies();
  return customFetch(
    { baseUrl: backendInternalUrl() },
    cookieStore?.get('auth')?.value!,
    cookieStore?.get('showorg')?.value!
  )(url, options);
};
