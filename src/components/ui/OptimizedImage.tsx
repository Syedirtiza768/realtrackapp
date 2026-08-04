/**
 * OptimizedImage — Centralized image component for the entire application.
 *
 * Features:
 * - Responsive srcset from backend-generated variants (thumb/sm/medium/lg)
 * - Proper sizes attribute based on actual layout
 * - Lazy loading by default (eager + fetchpriority for critical images)
 * - Blurhash/dominant-color placeholder from backend
 * - Aspect ratio reservation to prevent CLS
 * - Error fallback chain (variant → original → placeholder icon)
 * - decoding="async" for non-blocking decode
 * - Accessible alt text
 */

import { useState, useCallback, useRef, useEffect, type ImgHTMLAttributes } from 'react';
import { ImageIcon } from 'lucide-react';
import {
  getThumbUrl,
  getSmallUrl,
  getMediumUrl,
  getLargeUrl,
  buildSrcSet,
  isOurCdnUrl,
  handleImageError,
} from '../../lib/imageUrl';

export type ImageVariant = 'thumb' | 'small' | 'medium' | 'large' | 'original';

export interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'loading' | 'decoding' | 'onError'> {
  /** Full-resolution image URL (CDN or external) */
  src: string | null | undefined;
  /** Alt text — required for accessibility. Use "" for decorative images. */
  alt: string;
  /** Display variant — controls which derivative to load. Default: 'medium' */
  variant?: ImageVariant;
  /** Whether this image is above the fold / critical for LCP. Default: false */
  priority?: boolean;
  /** Responsive sizes attribute. Default based on variant */
  sizes?: string;
  /** Blurhash data URL from backend (tiny WebP placeholder) */
  blurhash?: string | null;
  /** Dominant color hex from backend */
  dominantColor?: string | null;
  /** Aspect ratio to reserve space (e.g. '4/3', '1/1'). Default: '1/1' */
  aspectRatio?: string;
  /** Object-fit behavior. Default: 'cover' */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  /** Custom fallback element when image fails to load */
  fallback?: React.ReactNode;
  /** Called when image loads successfully */
  onLoadCallback?: () => void;
  /** Called when image fails to load */
  onErrorCallback?: () => void;
}

const VARIANT_URL_MAP: Record<string, (url: string) => string> = {
  thumb: getThumbUrl,
  small: getSmallUrl,
  medium: getMediumUrl,
  large: getLargeUrl,
  original: (url: string) => url,
};

const DEFAULT_SIZES: Record<ImageVariant, string> = {
  thumb: '48px',
  small: '320px',
  medium: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px',
  large: '(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px',
  original: '100vw',
};

export default function OptimizedImage({
  src,
  alt,
  variant = 'medium',
  priority = false,
  sizes,
  blurhash,
  dominantColor,
  aspectRatio = '1/1',
  objectFit = 'cover',
  fallback,
  onLoadCallback,
  onErrorCallback,
  className = '',
  style,
  ...rest
}: OptimizedImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    src ? 'loading' : 'error',
  );
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset state when src changes
  useEffect(() => {
    if (src) {
      setStatus('loading');
    } else {
      setStatus('error');
    }
  }, [src]);

  const handleLoad = useCallback(() => {
    setStatus('loaded');
    onLoadCallback?.();
  }, [onLoadCallback]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      // Try falling back to original URL if we were showing a variant
      if (src && isOurCdnUrl(src) && img.src !== src) {
        img.onerror = null;
        img.src = src;
        return;
      }
      setStatus('error');
      onErrorCallback?.();
      handleImageError(e, null);
    },
    [src, onErrorCallback],
  );

  // Determine the actual image URL to display
  const getDisplayUrl = (): string => {
    if (!src) return '';
    if (!isOurCdnUrl(src)) return src;
    return VARIANT_URL_MAP[variant]?.(src) ?? src;
  };

  const displayUrl = getDisplayUrl();
  const srcSet = priority ? undefined : buildSrcSet(src);
  const resolvedSizes = sizes ?? DEFAULT_SIZES[variant];
  const hasBlurhash = !!blurhash && blurhash.startsWith('data:');

  // Placeholder background style
  const placeholderStyle: React.CSSProperties = hasBlurhash
    ? {
        backgroundImage: `url(${blurhash})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : dominantColor
      ? { backgroundColor: dominantColor }
      : { backgroundColor: '#f1f5f9' };

  // Container style with aspect ratio
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    aspectRatio,
    overflow: 'hidden',
    ...placeholderStyle,
    ...style,
  };

  // Image style
  const imgStyle: React.CSSProperties = {
    objectFit,
    transition: 'opacity 0.2s ease',
    opacity: status === 'loaded' ? 1 : 0,
  };

  if (!src || status === 'error') {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${className}`}
        style={containerStyle}
      >
        <ImageIcon className="h-1/3 w-1/3 text-slate-300 dark:text-slate-600" />
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      <img
        ref={imgRef}
        src={displayUrl}
        srcSet={srcSet}
        sizes={resolvedSizes}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        style={imgStyle}
        {...rest}
      />
    </div>
  );
}
