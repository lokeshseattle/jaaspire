import * as ImageManipulator from 'expo-image-manipulator';

export interface FilterDefinition {
  id: string;
  name: string;
  cssFilter: string;
  adjustments: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    sepia?: number;
    hue?: number;
  };
  // For React Native native implementation
  overlayColor?: string;
  overlayOpacity?: number;
  blendMode?: 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';
}

export const FILTERS: FilterDefinition[] = [
  { id: 'none', name: 'Normal', cssFilter: 'none', adjustments: {} },
  { 
    id: 'clarendon', 
    name: 'Clarendon', 
    cssFilter: 'brightness(1.05) contrast(1.2) saturate(1.15)',
    adjustments: { brightness: 5, contrast: 20, saturation: 15 },
    overlayColor: '#4A90E2',
    overlayOpacity: 0.05,
    blendMode: 'overlay'
  },
  { 
    id: 'gingham', 
    name: 'Gingham', 
    cssFilter: 'sepia(0.2) brightness(1.1) saturate(0.9)',
    adjustments: { sepia: 20, brightness: 10, saturation: -10 },
    overlayColor: '#D4A574',
    overlayOpacity: 0.08,
    blendMode: 'overlay'
  },
  { 
    id: 'moon', 
    name: 'Moon', 
    cssFilter: 'grayscale(1) contrast(1.3) brightness(1.05)',
    adjustments: { saturation: -100, contrast: 30, brightness: 5 },
    overlayColor: '#000000',
    overlayOpacity: 0.1,
    blendMode: 'multiply'
  },
  { 
    id: 'lark', 
    name: 'Lark', 
    cssFilter: 'brightness(1.1) contrast(0.95) saturate(1.05)',
    adjustments: { brightness: 10, contrast: -5, saturation: 5 },
    overlayColor: '#A8C5E8',
    overlayOpacity: 0.06,
    blendMode: 'screen'
  },
  { 
    id: 'reyes', 
    name: 'Reyes', 
    cssFilter: 'sepia(0.3) brightness(1.05) saturate(0.85)',
    adjustments: { sepia: 30, brightness: 5, saturation: -15 },
    overlayColor: '#C9A961',
    overlayOpacity: 0.1,
    blendMode: 'overlay'
  },
  { 
    id: 'juno', 
    name: 'Juno', 
    cssFilter: 'saturate(1.2) brightness(1.05) contrast(1.05)',
    adjustments: { saturation: 20, brightness: 5, contrast: 5 },
    overlayColor: '#FFD700',
    overlayOpacity: 0.05,
    blendMode: 'overlay'
  },
  { 
    id: 'slumber', 
    name: 'Slumber', 
    cssFilter: 'saturate(0.8) brightness(1.1) contrast(0.95)',
    adjustments: { saturation: -20, brightness: 10, contrast: -5 },
    overlayColor: '#F5E6D3',
    overlayOpacity: 0.08,
    blendMode: 'screen'
  },
  { 
    id: 'crema', 
    name: 'Crema', 
    cssFilter: 'sepia(0.15) brightness(1.05) saturate(0.9)',
    adjustments: { sepia: 15, brightness: 5, saturation: -10 },
    overlayColor: '#E8D5B5',
    overlayOpacity: 0.07,
    blendMode: 'overlay'
  },
  { 
    id: 'ludwig', 
    name: 'Ludwig', 
    cssFilter: 'saturate(0.85) contrast(1.1) brightness(0.95)',
    adjustments: { saturation: -15, contrast: 10, brightness: -5 },
    overlayColor: '#5A7C9E',
    overlayOpacity: 0.06,
    blendMode: 'multiply'
  },
  { 
    id: 'aden', 
    name: 'Aden', 
    cssFilter: 'sepia(0.2) saturate(0.85) brightness(1.05)',
    adjustments: { sepia: 20, saturation: -15, brightness: 5 },
    overlayColor: '#FFB6C1',
    overlayOpacity: 0.08,
    blendMode: 'overlay'
  },
  { 
    id: 'perpetua', 
    name: 'Perpetua', 
    cssFilter: 'brightness(1.1) saturate(1.1) contrast(1.05)',
    adjustments: { brightness: 10, saturation: 10, contrast: 5 },
    overlayColor: '#87CEEB',
    overlayOpacity: 0.05,
    blendMode: 'screen'
  },
  { 
    id: 'amaro', 
    name: 'Amaro', 
    cssFilter: 'brightness(1.15) saturate(1.05) contrast(0.95)',
    adjustments: { brightness: 15, saturation: 5, contrast: -5 },
    overlayColor: '#FFE4B5',
    overlayOpacity: 0.07,
    blendMode: 'screen'
  },
  { 
    id: 'mayfair', 
    name: 'Mayfair', 
    cssFilter: 'sepia(0.1) saturate(1.1) contrast(1.1) brightness(1.05)',
    adjustments: { sepia: 10, saturation: 10, contrast: 10, brightness: 5 },
    overlayColor: '#FF6B6B',
    overlayOpacity: 0.06,
    blendMode: 'overlay'
  },
  { 
    id: 'rise', 
    name: 'Rise', 
    cssFilter: 'brightness(1.1) saturate(0.95) contrast(0.95)',
    adjustments: { brightness: 10, saturation: -5, contrast: -5 },
    overlayColor: '#FFA07A',
    overlayOpacity: 0.08,
    blendMode: 'screen'
  },
  { 
    id: 'hudson', 
    name: 'Hudson', 
    cssFilter: 'brightness(1.1) contrast(1.2) saturate(0.9)',
    adjustments: { brightness: 10, contrast: 20, saturation: -10 },
    overlayColor: '#4682B4',
    overlayOpacity: 0.07,
    blendMode: 'multiply'
  },
  { 
    id: 'valencia', 
    name: 'Valencia', 
    cssFilter: 'sepia(0.25) saturate(0.9) brightness(1.05)',
    adjustments: { sepia: 25, saturation: -10, brightness: 5 },
    overlayColor: '#FFA500',
    overlayOpacity: 0.08,
    blendMode: 'overlay'
  },
  { 
    id: 'xpro2', 
    name: 'X-Pro II', 
    cssFilter: 'contrast(1.2) saturate(1.15) sepia(0.1)',
    adjustments: { contrast: 20, saturation: 15, sepia: 10 },
    overlayColor: '#FFD700',
    overlayOpacity: 0.06,
    blendMode: 'overlay'
  },
  { 
    id: 'sierra', 
    name: 'Sierra', 
    cssFilter: 'contrast(0.9) saturate(0.85) brightness(1.05)',
    adjustments: { contrast: -10, saturation: -15, brightness: 5 },
    overlayColor: '#8B7355',
    overlayOpacity: 0.07,
    blendMode: 'multiply'
  },
  { 
    id: 'willow', 
    name: 'Willow', 
    cssFilter: 'grayscale(0.8) brightness(1.1) contrast(0.95)',
    adjustments: { saturation: -80, brightness: 10, contrast: -5 },
    overlayColor: '#D8BFD8',
    overlayOpacity: 0.08,
    blendMode: 'overlay'
  },
  { 
    id: 'lofi', 
    name: 'Lo-Fi', 
    cssFilter: 'contrast(1.2) saturate(1.25) brightness(1.05)',
    adjustments: { contrast: 20, saturation: 25, brightness: 5 },
    overlayColor: '#FF8C00',
    overlayOpacity: 0.07,
    blendMode: 'overlay'
  },
  { 
    id: 'inkwell', 
    name: 'Inkwell', 
    cssFilter: 'grayscale(1)',
    adjustments: { saturation: -100 },
    overlayColor: '#000000',
    overlayOpacity: 0.05,
    blendMode: 'multiply'
  },
  { 
    id: 'helena', 
    name: 'Helena', 
    cssFilter: 'sepia(0.15) saturate(0.9) brightness(1.05)',
    adjustments: { sepia: 15, saturation: -10, brightness: 5 },
    overlayColor: '#FF69B4',
    overlayOpacity: 0.06,
    blendMode: 'overlay'
  },
  { 
    id: 'ashby', 
    name: 'Ashby', 
    cssFilter: 'sepia(0.2) brightness(1.05) saturate(0.95)',
    adjustments: { sepia: 20, brightness: 5, saturation: -5 },
    overlayColor: '#DEB887',
    overlayOpacity: 0.08,
    blendMode: 'overlay'
  },
  { 
    id: 'jupiter', 
    name: 'Jupiter', 
    cssFilter: 'brightness(1.1) saturate(0.8) contrast(0.95)',
    adjustments: { brightness: 10, saturation: -20, contrast: -5 },
    overlayColor: '#B0C4DE',
    overlayOpacity: 0.07,
    blendMode: 'screen'
  },
];

export interface AdjustmentState {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  exposure: number;
  highlights: number;
  shadows: number;
  vignette: number;
}

export const DEFAULT_ADJUSTMENTS: AdjustmentState = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  vignette: 0,
};

/**
 * Convert adjustment values to CSS filter string
 */
export function getCSSFilterString(
  filter: FilterDefinition,
  intensity: number = 10000,
  adjustments: Partial<AdjustmentState> = {}
): string {
  const intensityFactor = intensity / 100;
  
  // Start with filter's CSS
  let cssFilter = filter.cssFilter;
  
  // Add manual adjustments
  if ((adjustments.brightness || 0) !== 0) {
    const value = 1 + ((adjustments.brightness || 0) / 100);
    cssFilter += ` brightness(${value.toFixed(2)})`;
  }
  
  if ((adjustments.contrast || 0) !== 0) {
    const value = 1 + ((adjustments.contrast || 0) / 100);
    cssFilter += ` contrast(${value.toFixed(2)})`;
  }
  
  if ((adjustments.saturation || 0) !== 0) {
    const value = 1 + ((adjustments.saturation || 0) / 100);
    cssFilter += ` saturate(${value.toFixed(2)})`;
  }
  
  if ((adjustments.warmth || 0) !== 0) {
    // Simulate warmth with sepia for warm, blue overlay for cool
    const value = Math.abs(adjustments.warmth || 0) / 100;
    if ((adjustments.warmth || 0) > 0) {
      cssFilter += ` sepia(${value.toFixed(2)})`;
    } else {
      cssFilter += ` hue-rotate(${(value * 30).toFixed(0)}deg)`;
    }
  }
  
  if ((adjustments.exposure || 0) !== 0) {
    const value = 1 + ((adjustments.exposure || 0) / 100);
    cssFilter += ` brightness(${value.toFixed(2)})`;
  }
  
  return cssFilter.trim();
}

/**
 * Get the final processed image URI after applying all filters and adjustments
 * This uses expo-image-manipulator for permanent changes
 */
export async function processImage(
  uri: string,
  filter: FilterDefinition,
  intensity: number,
  adjustments: AdjustmentState
): Promise<string> {
  try {
    // For now, just return the original URI
    // In a production app, you'd use a server-side processing service
    // or a more advanced library for permanent filter application
    return uri;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

/**
 * Simple image processing that only does crop/resize/rotate
 * For actual filter application, we use CSS filters in the UI
 */
export async function finalizeImage(
  uri: string,
  options?: {
    resize?: { width: number; height: number };
    rotate?: number;
  }
): Promise<string> {
  try {
    let manipulator = ImageManipulator.useImageManipulator(uri);
    
    if (options?.resize) {
      manipulator = manipulator.resize(options.resize);
    }
    
    if (options?.rotate) {
      manipulator = manipulator.rotate(options.rotate);
    }
    
    const result = await manipulator.renderAsync();
    const saved = await result.saveAsync({
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    
    return saved.uri;
  } catch (error) {
    console.error('Error finalizing image:', error);
    throw error;
  }
}
