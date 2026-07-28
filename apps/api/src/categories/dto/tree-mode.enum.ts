/**
 * Modo de operacion al mover o eliminar una carpeta que tiene subcarpetas:
 * - SUBTREE: la carpeta y TODA la estructura que cuelga de ella.
 * - SINGLE: solo la carpeta seleccionada; sus hijas directas suben a colgar
 *   de la carpeta padre inmediata (no se pierden).
 */
export enum TreeMode {
  SUBTREE = 'subtree',
  SINGLE = 'single',
}
