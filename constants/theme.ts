import { Platform } from 'react-native';

// Brand primary
export const PRIMARY = '#0a7ea4';
export const PRIMARY_DARK = '#085f7c';
export const PRIMARY_LIGHT = '#e6f4fa';

const tintColorLight = PRIMARY;
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// Diagnostic section colors
export const SectionColors = {
  medico:       { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
  nutricion:    { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
  psicologia:   { bg: '#fef9c3', text: '#854d0e', border: '#fde68a' },
  entrenador:   { bg: '#f3e8ff', text: '#7e22ce', border: '#e9d5ff' },
  fisioterapia: { bg: '#ffe4e6', text: '#be123c', border: '#fecdd3' },
} as const;

// Diagnostic status colors
export const StatusColors = {
  pendiente:         { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' },
  en_proceso:        { bg: '#fef9c3', text: '#854d0e', border: '#fde68a' },
  completo:          { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
  requiere_atencion: { bg: '#ffe4e6', text: '#be123c', border: '#fecdd3' },
} as const;

// Ticket priority colors
export const PriorityColors = {
  low:    { bg: '#f1f5f9', text: '#64748b' },
  medium: { bg: '#fef9c3', text: '#854d0e' },
  high:   { bg: '#fed7aa', text: '#9a3412' },
  urgent: { bg: '#ffe4e6', text: '#be123c' },
} as const;

// Ticket status colors
export const TicketStatusColors = {
  open:        { bg: '#dbeafe', text: '#1d4ed8' },
  in_progress: { bg: '#fef9c3', text: '#854d0e' },
  resolved:    { bg: '#dcfce7', text: '#15803d' },
  closed:      { bg: '#f1f5f9', text: '#64748b' },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
