import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardItemProps extends React.HTMLAttributes<HTMLDivElement> {}

const DashboardItem = React.forwardRef<HTMLDivElement, DashboardItemProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('p-3 bg-muted/30 rounded-lg', className)}
        {...props}
      />
    );
  }
);

DashboardItem.displayName = 'DashboardItem';

export { DashboardItem };
