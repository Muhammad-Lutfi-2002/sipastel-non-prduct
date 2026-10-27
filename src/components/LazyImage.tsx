import React, { useState } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: string;
  loading?: 'lazy' | 'eager';
  onClick?: () => void;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  aspectRatio = 'aspect-[3/4]',
  loading = 'lazy',
  onClick,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`relative w-full overflow-hidden bg-surface-hover ${aspectRatio}`}
      onClick={onClick}
    >
      {/* Subtle Skeleton Placeholder behind the image until loaded */}
      {!isLoaded && !hasError && (
        <div
          className="absolute inset-0 skeleton-shimmer z-0"
          aria-hidden="true"
        />
      )}

      {/* Main Image with Smooth Fade-in */}
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`w-full h-full object-cover object-center transition-opacity duration-300 ease-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
      />

      {/* Fallback if broken */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-hover text-muted text-xs p-2 text-center">
          <span>{alt || 'SIPASTEL Piece'}</span>
        </div>
      )}
    </div>
  );
};
