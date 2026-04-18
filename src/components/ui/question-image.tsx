"use client";

import React, { useState, useCallback, useEffect, useId } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { AlertCircle, Loader2 } from 'lucide-react';
import { type QuestionImage as QuestionImageType } from '@/lib/types/practice';
import { detectImageCrop } from '@/lib/utils/imageCrop';

interface QuestionImageProps {
  image: QuestionImageType;
  className?: string;
  priority?: boolean; // For question images that should load first
  size?: 'sm' | 'md' | 'lg' | 'xl';
  aspectRatio?: 'auto' | 'square' | 'video' | 'wide';
  removeBlack?: boolean;
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
  aspectRatio = 'auto',
  removeBlack = false
}: QuestionImageProps) {
  const { resolvedTheme } = useTheme();
  const [imageState, setImageState] = useState<ImageState>({
    loading: true,
    error: false,
    loaded: false
  });
  const [cropStyle, setCropStyle] = useState<React.CSSProperties>({});
  const [containerStyle, setContainerStyle] = useState<React.CSSProperties>({});
  
  const uniqueId = useId();
  const filterId = `remove-black-${uniqueId.replace(/:/g, '')}`;

  const imageData = image;
  
  // Check if we're in dark mode (resolvedTheme handles system theme resolution)
  // resolvedTheme may be undefined during SSR, so default to false
  const isDarkMode = resolvedTheme === 'dark';

  // Detect and apply automatic cropping for blank edges
  useEffect(() => {
    if (!imageState.loaded || !imageData.url) return;

    let cancelled = false;

    detectImageCrop(imageData.url).then((cropResult) => {
      if (cancelled || !cropResult) {
        console.log('[QuestionImage] No crop result, using original image');
        setCropStyle({});
        setContainerStyle({});
        return;
      }

      const { bounds, originalWidth, originalHeight, width: cropWidth, height: cropHeight } = cropResult;
      
      if (aspectRatio === 'auto') {
        // For auto aspect ratio, resize container to match crop and zoom image
        const widthPct = (originalWidth / cropWidth) * 100;
        const heightPct = (originalHeight / cropHeight) * 100;
        const leftPct = (bounds.left / cropWidth) * 100;
        const topPct = (bounds.top / cropHeight) * 100;

        const containerStyleResult = {
          aspectRatio: `${cropWidth} / ${cropHeight}`
        };

        const cropStyleResult = {
          position: 'absolute' as const,
          top: `-${topPct}%`,
          left: `-${leftPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
          maxWidth: 'none' as const,
          maxHeight: 'none' as const
        };

        console.log('[QuestionImage] Scaling calculations (auto aspect):', {
          originalSize: `${originalWidth}x${originalHeight}`,
          cropSize: `${cropWidth}x${cropHeight}`,
          scaleFactors: {
            width: `${widthPct.toFixed(2)}%`,
            height: `${heightPct.toFixed(2)}%`
          },
          offsets: {
            top: `-${topPct.toFixed(2)}%`,
            left: `-${leftPct.toFixed(2)}%`
          },
          containerAspectRatio: containerStyleResult.aspectRatio,
          finalImageStyle: cropStyleResult
        });

        setContainerStyle(containerStyleResult);
        setCropStyle(cropStyleResult);
      } else {
        // For fixed aspect ratios, keep using clip-path but try to center?
        // Just use clip-path for now as fallback
        const topPercent = (bounds.top / originalHeight) * 100;
        const rightPercent = ((originalWidth - bounds.right - 1) / originalWidth) * 100;
        const bottomPercent = ((originalHeight - bounds.bottom - 1) / originalHeight) * 100;
        const leftPercent = (bounds.left / originalWidth) * 100;

        const clipPathValue = `inset(${topPercent}% ${rightPercent}% ${bottomPercent}% ${leftPercent}%)`;

        console.log('[QuestionImage] Clip-path calculations (fixed aspect):', {
          originalSize: `${originalWidth}x${originalHeight}`,
          cropSize: `${cropWidth}x${cropHeight}`,
          clipPath: clipPathValue,
          percentages: {
            top: `${topPercent.toFixed(2)}%`,
            right: `${rightPercent.toFixed(2)}%`,
            bottom: `${bottomPercent.toFixed(2)}%`,
            left: `${leftPercent.toFixed(2)}%`
          }
        });

        setContainerStyle({});
        setCropStyle({
          clipPath: clipPathValue,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [imageState.loaded, imageData.url, aspectRatio]);

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
    sm: 'max-w-xs',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
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
      'relative rounded-lg overflow-hidden bg-background',
      sizeClasses[size],
      aspectClasses[aspectRatio],
      className
    )}
    style={containerStyle}>
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

      {/* SVG Filter Definition */}
      {removeBlack && (
        <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
          <filter id={filterId}>
            {/* Create a smoother alpha calculation using luminance */}
            {/* First, convert RGB to luminance for alpha calculation */}
            <feColorMatrix
              type="matrix"
              values="0.2126 0.7152 0.0722 0 0
                      0.2126 0.7152 0.0722 0 0
                      0.2126 0.7152 0.0722 0 0
                      0 0 0 1 0"
              result="luminance"
            />
            {/* Apply a smoother curve - makes dark pixels gradually transparent */}
            <feComponentTransfer in="luminance" result="smoothAlpha">
              <feFuncA type="linear" slope="1.5" intercept="-0.15" />
            </feComponentTransfer>
            {/* Use multiply composite to blend and preserve color intensity */}
            <feComposite
              in="SourceGraphic"
              in2="smoothAlpha"
              operator="arithmetic"
              k1="0"
              k2="0"
              k3="1"
              k4="0"
            />
          </filter>
        </svg>
      )}

      {/* Image Wrapper for Filter application */}
      <div 
        style={{
          ...cropStyle,
          // Apply filter only in dark mode
          ...(removeBlack && isDarkMode ? { filter: `url(#${filterId})` } : {}),
        }}
      >
        <img
          src={imageData.url}
          alt={imageData.alt || 'Question illustration'}
          className={cn(
            'transition-opacity duration-200 dark:invert',
            aspectRatio === 'auto' 
              ? 'w-full h-auto object-contain' 
              : 'w-full h-full object-contain',
            imageState.loaded ? 'opacity-100' : 'opacity-0'
          )}
          // cropStyle is moved to wrapper
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? 'eager' : 'lazy'}
          width={imageData.width}
          height={imageData.height}
        />
      </div>

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
  image: QuestionImageType;
  className?: string;
  selected?: boolean;
  disabled?: boolean;
  removeBlack?: boolean;
}

export function OptionImage({ image, className, selected, disabled, removeBlack }: OptionImageProps) {
  return (
    <div className={cn(
      'relative w-full rounded border overflow-hidden transition-all duration-200',
      selected && 'ring-2 ring-primary ring-offset-2',
      disabled && 'opacity-50',
      className
    )}>
      <QuestionImage 
        image={image} 
        size="sm" 
        aspectRatio="auto"
        priority={true}
        className="w-full"
        removeBlack={removeBlack}
      />
    </div>
  );
}
