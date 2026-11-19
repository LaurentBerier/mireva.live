import { useCallback } from 'react';
import { browserMediaUrl } from './browser.media.url';
export const useMediaDirectory = () => {
  const set = useCallback((path: string) => {
    return browserMediaUrl(path);
  }, []);
  return {
    set,
  };
};
