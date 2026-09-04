'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorDisplayProps {
  error: string | null;
  onRetry?: () => void;
  className?: string;
}

export function ErrorDisplay({ error, onRetry, className }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <div className={`rounded-lg border border-destructive/50 bg-destructive/10 p-4 ${className || ''}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold font-sans text-destructive mb-1">Error</h3>
          <p className="text-sm text-destructive/90">{error}</p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-3 border-destructive/30 hover:bg-destructive/20"
            >
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
