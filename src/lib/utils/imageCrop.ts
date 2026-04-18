/**
 * Detects blank edges (transparent, white, or black) in an image and returns crop bounds
 */

interface CropBounds {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface ImageCropResult {
  bounds: CropBounds;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

/**
 * Checks if a pixel color is considered "blank" (transparent, white, or black)
 */
function isBlankPixel(r: number, g: number, b: number, a: number, threshold: number = 10): boolean {
  // Fully transparent
  if (a < 10) return true;
  
  // White (all channels close to 255)
  if (r > 255 - threshold && g > 255 - threshold && b > 255 - threshold) return true;
  
  // Black (all channels close to 0)
  if (r < threshold && g < threshold && b < threshold) return true;
  
  return false;
}

/**
 * Analyzes an image to detect blank edges and calculate crop bounds
 */
export async function detectImageCrop(imageUrl: string, threshold: number = 10): Promise<ImageCropResult | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Try to set crossOrigin, but handle cases where it might fail
    try {
      img.crossOrigin = 'anonymous';
    } catch (e) {
      // Ignore crossOrigin errors
    }
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(null);
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        try {
          ctx.drawImage(img, 0, 0);
        } catch (e) {
          // CORS error or other draw error
          console.warn('Cannot analyze image for cropping (CORS or other error):', e);
          resolve(null);
          return;
        }
        
        let imageData;
        try {
          imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
          // CORS error - cannot read pixel data
          console.warn('Cannot read image data for cropping (CORS error):', e);
          resolve(null);
          return;
        }
        const data = imageData.data;
        
        let top = 0;
        let bottom = canvas.height - 1;
        let left = 0;
        let right = canvas.width - 1;
        
        // Find top edge
        for (let y = 0; y < canvas.height; y++) {
          let hasContent = false;
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            
            if (!isBlankPixel(r, g, b, a, threshold)) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) {
            top = y;
            break;
          }
        }
        
        // Find bottom edge
        for (let y = canvas.height - 1; y >= 0; y--) {
          let hasContent = false;
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            
            if (!isBlankPixel(r, g, b, a, threshold)) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) {
            bottom = y;
            break;
          }
        }
        
        // Find left edge
        for (let x = 0; x < canvas.width; x++) {
          let hasContent = false;
          for (let y = 0; y < canvas.height; y++) {
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            
            if (!isBlankPixel(r, g, b, a, threshold)) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) {
            left = x;
            break;
          }
        }
        
        // Find right edge
        for (let x = canvas.width - 1; x >= 0; x--) {
          let hasContent = false;
          for (let y = 0; y < canvas.height; y++) {
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            
            if (!isBlankPixel(r, g, b, a, threshold)) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) {
            right = x;
            break;
          }
        }
        
        // Calculate crop dimensions
        const cropWidth = right - left + 1;
        const cropHeight = bottom - top + 1;
        
        // Only return crop if it's significantly different (at least 5% reduction on any side)
        const minCropReduction = 0.05;
        const widthReduction = (canvas.width - cropWidth) / canvas.width;
        const heightReduction = (canvas.height - cropHeight) / canvas.height;
        
        console.log('[ImageCrop] Detection results:', {
          url: imageUrl.substring(0, 50) + '...',
          originalSize: `${canvas.width}x${canvas.height}`,
          cropBounds: { top, right, bottom, left },
          cropSize: `${cropWidth}x${cropHeight}`,
          widthReduction: `${(widthReduction * 100).toFixed(1)}%`,
          heightReduction: `${(heightReduction * 100).toFixed(1)}%`,
          pixelsCropped: {
            top: top,
            right: canvas.width - right - 1,
            bottom: canvas.height - bottom - 1,
            left: left
          }
        });
        
        if (widthReduction < minCropReduction && heightReduction < minCropReduction) {
          // No significant cropping needed
          console.log('[ImageCrop] No significant cropping needed (< 5% reduction)');
          resolve(null);
          return;
        }
        
        const result = {
          bounds: { top, right, bottom, left },
          width: cropWidth,
          height: cropHeight,
          originalWidth: canvas.width,
          originalHeight: canvas.height
        };
        
        console.log('[ImageCrop] Applying crop:', result);
        resolve(result);
      } catch (error) {
        console.error('Error detecting image crop:', error);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      resolve(null);
    };
    
    img.src = imageUrl;
  });
}
