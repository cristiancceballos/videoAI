import { Platform } from 'react-native';

/**
 * Font utility to provide proper Inter font family mapping
 * with cross-platform fallbacks
 */

export interface FontConfig {
  fontFamily: string;
  letterSpacing: number;
}

/**
 * Get the proper Inter font family based on font weight
 * User prefers elegant, lightweight typography for mobile:
 * - Bold text → Light 300 Italic
 * - Regular text → ExtraLight 200 Italic
 * @param weight - Font weight ('200', '300', '400', '500', '600', '700', 'normal', 'bold', etc.)
 * @returns FontConfig object with proper fontFamily and letterSpacing
 */
export function getInterFont(weight: string | number = '200'): FontConfig {
  // Normalize weight to string
  const normalizedWeight = String(weight);
  
  // Map font weights to lighter Inter variants for elegant typography
  let interVariant: string;
  let letterSpacing: number;
  
  switch (normalizedWeight) {
    case '200':
    case 'extralight':
    case 'normal':
      // Regular text uses ExtraLight 200 Italic for elegance
      interVariant = 'Inter_200ExtraLight_Italic';
      letterSpacing = -0.5; // Light negative spacing for regular text
      break;
    case '300':
    case 'light':
    case '400':
    case '500':
    case '600':
    case '700':
    case 'bold':
      // Bold text uses Light 300 Italic (lighter than traditional bold)
      interVariant = 'Inter_300Light_Italic';
      letterSpacing = -1.2; // More aggressive negative spacing for titles/bold text
      break;
    default:
      // Default to ExtraLight for any other weight
      interVariant = 'Inter_200ExtraLight_Italic';
      letterSpacing = -0.5;
  }

  // Provide cross-platform font fallbacks
  const fontFamily = Platform.OS === 'web' 
    ? `${interVariant}, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
    : interVariant;

  console.log(`🔤 Font config for weight ${normalizedWeight}:`, { interVariant, letterSpacing });

  return { 
    fontFamily,
    letterSpacing
  };
}

/**
 * Convenience functions for elegant lightweight typography
 */
export const InterFont = {
  regular: () => getInterFont('200'),    // ExtraLight 200 Italic
  bold: () => getInterFont('300'),       // Light 300 Italic  
  // Legacy aliases for backward compatibility
  extraLight: () => getInterFont('200'),
  light: () => getInterFont('300'),
};

/**
 * Get Inter font with specific weight for direct use in StyleSheet
 * @param weight - Font weight
 * @returns Font family string
 */
export function getInterFontFamily(weight: string | number = '200'): string {
  return getInterFont(weight).fontFamily;
}

/**
 * Get Inter font config object for spreading into styles
 * @param weight - Font weight  
 * @returns Object with fontFamily and letterSpacing properties for spreading
 */
export function getInterFontConfig(weight: string | number = '200'): { fontFamily: string; letterSpacing: number } {
  return getInterFont(weight);
}

/**
 * Alternative font config with non-italic variants for testing
 * @param weight - Font weight
 * @returns Font config with non-italic Inter variants and different spacing
 */
export function getInterFontConfigNonItalic(weight: string | number = '200'): { fontFamily: string; letterSpacing: number } {
  const normalizedWeight = String(weight);
  
  let interVariant: string;
  let letterSpacing: number;
  
  switch (normalizedWeight) {
    case '200':
    case 'extralight':
    case 'normal':
      interVariant = 'Inter_200ExtraLight';
      letterSpacing = -0.3; // Less aggressive spacing for non-italic
      break;
    case '300':
    case 'light':
    case 'bold':
      interVariant = 'Inter_300Light';
      letterSpacing = -0.8; // Moderate spacing for non-italic bold
      break;
    default:
      interVariant = 'Inter_200ExtraLight';
      letterSpacing = -0.3;
  }

  const fontFamily = Platform.OS === 'web' 
    ? `${interVariant}, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
    : interVariant;

  console.log(`🔤 NON-ITALIC Font config for weight ${normalizedWeight}:`, { interVariant, letterSpacing });

  return { fontFamily, letterSpacing };
}