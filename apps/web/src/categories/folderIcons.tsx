import {
  IconBook,
  IconBrain,
  IconBriefcase,
  IconBulb,
  IconCamera,
  IconChartBar,
  IconCode,
  IconFlask,
  IconFolder,
  IconHeart,
  IconInbox,
  IconLanguage,
  IconLeaf,
  IconMusic,
  IconPlane,
  IconRocket,
  IconSchool,
  IconStar,
  IconTarget,
  IconWallet,
  type IconProps,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { DEFAULT_FOLDER_COLOR } from '../theme';

/**
 * Catalogo de iconos que puede tener una carpeta. La CLAVE es lo que se guarda
 * en `Category.icon` (campo de 50 caracteres), no el SVG: asi el icono se puede
 * cambiar sin migrar datos.
 */
const ICONS: Record<string, ComponentType<IconProps>> = {
  folder: IconFolder,
  code: IconCode,
  school: IconSchool,
  language: IconLanguage,
  book: IconBook,
  brain: IconBrain,
  bulb: IconBulb,
  rocket: IconRocket,
  briefcase: IconBriefcase,
  wallet: IconWallet,
  target: IconTarget,
  chart: IconChartBar,
  flask: IconFlask,
  leaf: IconLeaf,
  plane: IconPlane,
  camera: IconCamera,
  music: IconMusic,
  heart: IconHeart,
  star: IconStar,
  inbox: IconInbox,
};

/** Claves en el orden en que se ofrecen en el selector del modal. */
export const FOLDER_ICON_KEYS = Object.keys(ICONS);

/** Clave por defecto de una carpeta sin `icon` en la BD. */
export const DEFAULT_FOLDER_ICON = 'folder';

interface FolderIconProps {
  /** Clave guardada en la BD; si no esta en el catalogo, cae a `folder`. */
  icon: string | null;
  /** Nombre de color de Mantine guardado en la BD. */
  color?: string | null;
  size?: number;
  stroke?: number;
}

/**
 * Icono de una carpeta, resuelto desde lo que hay en la BD. Es tolerante a
 * valores desconocidos a proposito: un icono retirado del catalogo no debe
 * dejar la carpeta sin pintar.
 */
export function FolderIcon({ icon, color, size = 18, stroke = 1.8 }: FolderIconProps) {
  const Cmp = ICONS[icon ?? ''] ?? ICONS[DEFAULT_FOLDER_ICON];
  return (
    <Cmp
      size={size}
      stroke={stroke}
      color={`var(--mantine-color-${color ?? DEFAULT_FOLDER_COLOR}-filled)`}
    />
  );
}
