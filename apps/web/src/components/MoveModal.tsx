import { Button, Group, Modal, Radio, Stack, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { CategoryNode, TreeMode } from '../lib/api';
import { DestinationPicker, type Destination } from './DestinationPicker';

function collectSubtreeIds(node: CategoryNode): Set<string> {
  const ids = new Set<string>();
  const stack = [...node.children];
  while (stack.length > 0) {
    const current = stack.pop() as CategoryNode;
    ids.add(current.id);
    stack.push(...current.children);
  }
  return ids;
}

interface MoveModalProps {
  target: CategoryNode;
  tree: CategoryNode[];
  onCancel: () => void;
  onConfirm: (parentId: string | null, mode: TreeMode) => void;
}

export function MoveModal({ target, tree, onCancel, onConfirm }: MoveModalProps) {
  // No se puede mover una carpeta dentro de si misma ni de su subarbol.
  const disabledIds = useMemo(() => {
    const ids = collectSubtreeIds(target);
    ids.add(target.id);
    return ids;
  }, [target]);

  const [dest, setDest] = useState<Destination>(undefined);
  const [mode, setMode] = useState<TreeMode>('subtree');
  const hasChildren = target.children.length > 0;

  return (
    <Modal opened onClose={onCancel} title={`Mover «${target.name}» a…`} size="md">
      <Stack gap="md">
        <DestinationPicker
          tree={tree}
          value={dest}
          onChange={setDest}
          disabledIds={disabledIds}
          currentId={target.parentId}
        />

        {hasChildren && (
          <Radio.Group
            value={mode}
            onChange={(value) => setMode(value as TreeMode)}
            label="Esta carpeta tiene subcarpetas"
          >
            <Stack gap="xs" mt="xs">
              <Radio value="subtree" label="Mover toda la estructura" />
              <Radio
                value="single"
                label="Mover solo esta carpeta"
                description="Las subcarpetas suben al nivel de origen"
              />
            </Stack>
          </Radio.Group>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            disabled={dest === undefined}
            onClick={() => {
              if (dest !== undefined) {
                onConfirm(dest, mode);
              }
            }}
          >
            Mover
          </Button>
        </Group>

        {dest === undefined && (
          <Text size="xs" c="dimmed" ta="right" mt={-8}>
            Elige una carpeta de destino
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
