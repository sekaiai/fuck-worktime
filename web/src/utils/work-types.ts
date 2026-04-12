import type { WorkTypeNode } from '../types/timesheet';

export interface WorkTypeGroup {
  id: string;
  name: string;
  children: WorkTypeNode[];
}

export function buildWorkTypeGroups(nodes: WorkTypeNode[]): WorkTypeGroup[] {
  return nodes
    .filter((node) => Boolean(node.id))
    .map((node) => ({
      id: node.id,
      name: node.name,
      children: node.children && node.children.length > 0 ? node.children : [node],
    }));
}

export function findWorkTypeById(groups: WorkTypeGroup[], workTypeId: string): WorkTypeNode | null {
  for (const group of groups) {
    const target = group.children.find((child) => child.id === workTypeId);
    if (target) {
      return target;
    }
  }

  return null;
}
