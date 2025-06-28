
import React from 'react';
import { Skeleton } from './skeleton';

export const ResultCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-6 w-16" />
    </div>
    <Skeleton className="h-4 w-3/4" />
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
    </div>
  </div>
);

export const StatCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 p-4 rounded-xl">
    <Skeleton className="h-8 w-16 mb-2" />
    <Skeleton className="h-4 w-24 mb-1" />
    <Skeleton className="h-3 w-20" />
  </div>
);
