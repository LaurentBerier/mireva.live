'use client';

import { FC } from 'react';
import { browserMediaUrl } from './browser.media.url';
export const VideoFrame: FC<{
  url: string;
  autoplay?: boolean;
}> = (props) => {
  const { url } = props;
  return (
    <video
      className="w-full h-full object-cover rounded-[4px]"
      src={browserMediaUrl(url) + '#t=0.1'}
      preload="metadata"
      autoPlay={!!props?.autoplay}
    />
  );
};
