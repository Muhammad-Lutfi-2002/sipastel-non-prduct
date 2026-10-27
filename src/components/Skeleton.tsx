import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`skeleton-shimmer rounded-[2px] ${className}`}
      aria-hidden="true"
    />
  );
};

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col justify-between">
      {/* 3:4 Aspect ratio image placeholder */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[2px] border border-line skeleton-shimmer" />

      {/* Info lines */}
      <div className="pt-3 pb-1 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <div className="flex gap-1">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-3 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center justify-between pt-0.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-12 sm:hidden" />
        </div>
      </div>
    </div>
  );
};

export const ProductGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
};

export const ProductDetailSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 p-5 sm:p-8">
      {/* Image Gallery Column */}
      <div className="md:col-span-6 space-y-3">
        <div className="aspect-[3/4] w-full skeleton-shimmer rounded-[2px] border border-line" />
        <div className="flex gap-2">
          <Skeleton className="w-16 h-20" />
          <Skeleton className="w-16 h-20" />
          <Skeleton className="w-16 h-20" />
        </div>
      </div>

      {/* Details Column */}
      <div className="md:col-span-6 space-y-5">
        <div>
          <Skeleton className="h-7 w-3/4 mb-2" />
          <Skeleton className="h-6 w-28 mb-3" />
          <Skeleton className="h-4 w-full mb-1.5" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        <div className="border-t border-line pt-4 space-y-2">
          <Skeleton className="h-3 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>

        <div className="border-t border-line pt-4 space-y-2">
          <Skeleton className="h-3 w-16" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-12" />
            <Skeleton className="h-10 w-12" />
            <Skeleton className="h-10 w-12" />
            <Skeleton className="h-10 w-12" />
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <Skeleton className="h-12 w-full mb-2" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </div>
  );
};

export const CartItemSkeleton: React.FC = () => {
  return (
    <div className="flex gap-3.5 items-start py-3">
      <Skeleton className="w-20 h-24 shrink-0 rounded-[2px]" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
};

export const AdminTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  return (
    <div className="space-y-2" role="status" aria-label="Loading data">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3.5 border border-line rounded-lg bg-surface">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
};

export const InstagramGallerySkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[3/4] rounded-xs skeleton-shimmer border border-line"
        />
      ))}
    </div>
  );
};
