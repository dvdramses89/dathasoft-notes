import { createTheme, type MantineColorsTuple } from '@mantine/core';

/**
 * Escala de la marca (indigo). Conserva el acento que ya tenia la app
 * (#6366f1 = tono 5) pero completo en 10 pasos, que es lo que pide Mantine.
 */
const brand: MantineColorsTuple = [
  '#eef2ff',
  '#e0e7ff',
  '#c7d2fe',
  '#a5b4fc',
  '#818cf8',
  '#6366f1',
  '#4f46e5',
  '#4338ca',
  '#3730a3',
  '#312e81',
];

/**
 * Colores que puede tener una carpeta. Se guarda el NOMBRE en `Category.color`
 * (el campo admite 50 caracteres), no un hex: asi Mantine elige el tono que
 * toca en cada tema y el color no se ve apagado en oscuro ni chillon en claro.
 */
export const FOLDER_COLORS = [
  'gray',
  'indigo',
  'blue',
  'cyan',
  'teal',
  'green',
  'lime',
  'yellow',
  'orange',
  'red',
  'pink',
  'grape',
  'violet',
] as const;

export type FolderColor = (typeof FOLDER_COLORS)[number];

/** Color por defecto de una carpeta sin `color` en la BD. */
export const DEFAULT_FOLDER_COLOR: FolderColor = 'gray';

export const theme = createTheme({
  colors: { brand },
  primaryColor: 'brand',
  // Tono 6 en claro (contraste suficiente sobre blanco) y 4 en oscuro.
  primaryShade: { light: 6, dark: 4 },
  // La misma pila que usaba el CSS a mano, para que no cambie la letra.
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontWeight: '600',
  },
  defaultRadius: 'md',
  radius: { md: '0.625rem', lg: '0.875rem' },
  cursorType: 'pointer',
  components: {
    // Los modales de la app son todos centrados y con el fondo desenfocado.
    Modal: {
      defaultProps: {
        centered: true,
        overlayProps: { backgroundOpacity: 0.5, blur: 3 },
        radius: 'lg',
      },
    },
    Tooltip: {
      defaultProps: { withArrow: true, openDelay: 400, fz: 'xs' },
    },
    Card: {
      defaultProps: { withBorder: true, radius: 'lg' },
    },
  },
});
