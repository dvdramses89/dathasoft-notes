import { Box, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconCheck, IconHome } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { FolderIcon } from '../categories/folderIcons';
import type { CategoryNode } from '../lib/api';

/** `undefined` = todavia no se ha elegido nada; `null` = la raiz. */
export type Destination = string | null | undefined;

interface DestinationPickerProps {
  tree: CategoryNode[];
  value: Destination;
  onChange: (categoryId: string | null) => void;
  /** Carpetas que no se pueden elegir (destino invalido). */
  disabledIds?: Set<string>;
  /** Carpeta donde esta ahora el elemento, para marcarla como «actual». */
  currentId?: string | null;
}

/**
 * Arbol de carpetas para elegir un destino. Lo comparten los dos dialogos de
 * mover (carpeta y documento), que solo se diferencian en qué destinos vetan.
 */
export function DestinationPicker({
  tree,
  value,
  onChange,
  disabledIds,
  currentId,
}: DestinationPickerProps) {
  function Row({
    id,
    depth,
    label,
    icon,
    disabled,
  }: {
    id: string | null;
    depth: number;
    label: string;
    icon: ReactNode;
    disabled: boolean;
  }) {
    const selected = value === id;
    const isCurrent = currentId !== undefined && currentId === id;
    return (
      <UnstyledButton
        type="button"
        disabled={disabled}
        onClick={() => onChange(id)}
        className={`tree-row${selected ? ' tree-row--active' : ''}`}
        style={{
          paddingLeft: `${depth * 14 + 8}px`,
          opacity: disabled ? 0.45 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        title={isCurrent ? 'Ya está aquí' : undefined}
      >
        {icon}
        <Text component="span" size="sm" className="tree-row-name">
          {label}
        </Text>
        {isCurrent && (
          <Text component="span" size="xs" c="dimmed">
            actual
          </Text>
        )}
        {selected && <IconCheck size={15} />}
      </UnstyledButton>
    );
  }

  function renderNodes(nodes: CategoryNode[], depth: number): ReactNode {
    return nodes.map((node) => (
      <Box key={node.id}>
        <Row
          id={node.id}
          depth={depth}
          label={node.name}
          icon={<FolderIcon icon={node.icon} color={node.color} size={16} />}
          disabled={(disabledIds?.has(node.id) ?? false) || currentId === node.id}
        />
        {node.children.length > 0 && renderNodes(node.children, depth + 1)}
      </Box>
    ));
  }

  return (
    <ScrollArea.Autosize mah={280} type="auto" offsetScrollbars>
      <Stack gap={2}>
        <Row
          id={null}
          depth={0}
          label="Mi espacio (nivel superior)"
          icon={<IconHome size={16} stroke={1.8} />}
          disabled={currentId === null}
        />
        {renderNodes(tree, 0)}
      </Stack>
    </ScrollArea.Autosize>
  );
}
