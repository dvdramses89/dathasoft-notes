import { Button, Group, Modal, Stack } from '@mantine/core';
import { useState } from 'react';
import type { CategoryNode } from '../lib/api';
import { DestinationPicker, type Destination } from './DestinationPicker';

interface MoveDocumentModalProps {
  /** Título del documento que se está moviendo. */
  title: string;
  /** Carpeta en la que está ahora (null = raíz), para marcarla y desactivarla. */
  currentCategoryId: string | null;
  tree: CategoryNode[];
  onCancel: () => void;
  onConfirm: (categoryId: string | null) => void;
}

/**
 * Selector de carpeta destino para un documento. A diferencia de las carpetas,
 * un documento no tiene estructura debajo: no hay modos ni destinos prohibidos
 * (solo su carpeta actual, que no tiene sentido reelegir).
 */
export function MoveDocumentModal({
  title,
  currentCategoryId,
  tree,
  onCancel,
  onConfirm,
}: MoveDocumentModalProps) {
  const [dest, setDest] = useState<Destination>(undefined);

  return (
    <Modal opened onClose={onCancel} title={`Mover «${title}» a…`} size="md">
      <Stack gap="md">
        <DestinationPicker
          tree={tree}
          value={dest}
          onChange={setDest}
          currentId={currentCategoryId}
        />

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            disabled={dest === undefined}
            onClick={() => {
              if (dest !== undefined) {
                onConfirm(dest);
              }
            }}
          >
            Mover
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
