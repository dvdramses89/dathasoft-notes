import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TreeMode } from './tree-mode.enum';

export class MoveCategoryDto {
  // Destino: uuid de la carpeta padre, o null/omitido para mover a la raiz.
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  // Mover solo esta carpeta (SINGLE) o toda su estructura (SUBTREE).
  @IsEnum(TreeMode)
  mode: TreeMode;
}
