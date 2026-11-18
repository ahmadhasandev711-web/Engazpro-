import React, { useEffect, useState } from 'react';
import { cn } from '../../utils/cn';

interface ProductThumbnailProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export const ProductThumbnail: React.FC<ProductThumbnailProps> = ({ src, alt, className }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return null;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('object-cover shrink-0 bg-surface-2 border border-line', className)}
    />
  );
};
