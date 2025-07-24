import { Platform } from 'react-native';

/**
 * Font utility to provide proper Inter font family mapping
 * with cross-platform fallbacks
 */

export interface FontConfig {
  fontFamily: string;
}

/**
 * Get the proper Inter font family based on font weight
 * @param weight - Font weight ('400', '500', '600', '700', 'normal', 'bold', etc.)
 * @returns FontConfig object with proper fontFamily
 */
export function getInterFont(weight: string | number = '400'): FontConfig {
  // Normalize weight to string
  const normalizedWeight = String(weight);
  
  // Map font weights to Inter variants
  let interVariant: string;
  
  switch (normalizedWeight) {
    case '400':
    case 'normal':
      interVariant = 'Inter_400Regular';
      break;
    case '500':
      interVariant = 'Inter_500Medium';
      break;
    case '600':
      interVariant = 'Inter_600SemiBold';
      break;
    case '700':
    case 'bold':
      interVariant = 'Inter_700Bold';
      break;
    default:
      // Default to regular for any other weight
      interVariant = 'Inter_400Regular';
  }

  // Provide cross-platform font fallbacks
  const fontFamily = Platform.OS === 'web' 
    ? `${interVariant}, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
    : interVariant;

  return { fontFamily };
}

/**
 * Convenience functions for common font weights
 */
export const InterFont = {
  regular: () => getInterFont('400'),
  medium: () => getInterFont('500'),
  semiBold: () => getInterFont('600'),
  bold: () => getInterFont('700'),
};

/**
 * Get Inter font with specific weight for direct use in StyleSheet
 * @param weight - Font weight
 * @returns Font family string
 */
export function getInterFontFamily(weight: string | number = '400'): string {
  return getInterFont(weight).fontFamily;
}

/**
 * Get Inter font config object for spreading into styles
 * @param weight - Font weight  
 * @returns Object with fontFamily property for spreading
 */
export function getInterFontConfig(weight: string | number = '400'): { fontFamily: string } {
  return getInterFont(weight);
}