"use client";

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, Loader2 } from 'lucide-react';
import { type QuestionImage as QuestionImageType } from '@/lib/types/practice';

interface QuestionImageProps {
  image: QuestionImageType | string;
  className?: string;
  priority?: boolean; // For question images that should load first
  size?: 'sm' | 'md' | 'lg' | 'xl';
  aspectRatio?: 'auto' | 'square' | 'video' | 'wide';
}

interface ImageState {
  loading: boolean;
  error: boolean;
  loaded: boolean;
}

export function QuestionImage({ 
  image, 
  className, 
  priority = false,
  size = 'md',
  aspectRatio = 'auto'
}: QuestionImageProps) {
  const [imageState, setImageState] = useState<ImageState>({
    loading: true,
    error: false,
    loaded: false
  });

  // Handle both legacy string URLs and new QuestionImage objects
  const imageData = typeof image === 'string' 
    ? { url: image, alt: 'Question illustration' }
    : image;

  const handleLoad = useCallback(() => {
    setImageState({
      loading: false,
      error: false,
      loaded: true
    });
  }, []);

  const handleError = useCallback(() => {
    setImageState({
      loading: false,
      error: true,
      loaded: false
    });
  }, []);

  const handleRetry = useCallback(() => {
    setImageState({
      loading: true,
      error: false,
      loaded: false
    });
  }, []);

  // Size classes - with auto aspect ratio support
  const sizeClasses = {
    sm: aspectRatio === 'auto' ? 'max-w-xs' : 'max-w-xs max-h-48',
    md: aspectRatio === 'auto' ? 'max-w-md' : 'max-w-md max-h-64',
    lg: aspectRatio === 'auto' ? 'max-w-lg' : 'max-w-lg max-h-80',
    xl: aspectRatio === 'auto' ? 'max-w-2xl' : 'max-w-2xl max-h-96'
  };

  // Aspect ratio classes
  const aspectClasses = {
    auto: '',
    square: 'aspect-square',
    video: 'aspect-video',
    wide: 'aspect-[16/9]'
  };

  // Don't render if no valid URL
  if (!imageData.url || imageData.url.trim() === '') {
    return null;
  }

  return (
    <div className={cn(
      'relative rounded-lg border overflow-hidden bg-muted/30',
      sizeClasses[size],
      aspectClasses[aspectRatio],
      className
    )}>
      {/* Loading State */}
      {imageState.loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading image...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {imageState.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
            <AlertCircle className="h-8 w-8" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Failed to load image</p>
              <button
                onClick={handleRetry}
                className="text-xs text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image */}
      <img
        src={imageData.url}
        alt={imageData.alt || 'Question illustration'}
        className={cn(
          'transition-opacity duration-200',
          aspectRatio === 'auto' 
            ? 'w-full h-auto object-contain' 
            : 'w-full h-full object-contain',
          imageState.loaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={handleLoad}
        onError={handleError}
        loading={priority ? 'eager' : 'lazy'}
        width={imageData.width}
        height={imageData.height}
      />

      {/* Caption */}
      {imageData.caption && imageState.loaded && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2">
          {imageData.caption}
        </div>
      )}
    </div>
  );
}

// Smaller component for option images
interface OptionImageProps {
  image: QuestionImageType | string;
  className?: string;
  selected?: boolean;
  disabled?: boolean;
}

export function OptionImage({ image, className, selected, disabled }: OptionImageProps) {
  return (
    <div className={cn(
      'relative w-full h-24 rounded border overflow-hidden transition-all duration-200',
      selected && 'ring-2 ring-primary ring-offset-2',
      disabled && 'opacity-50',
      className
    )}>
      <QuestionImage 
        image={image} 
        size="sm" 
        aspectRatio="auto"
        className="w-full h-full"
      />
    </div>
  );
} 