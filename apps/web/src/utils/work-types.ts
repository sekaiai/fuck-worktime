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

/** 拍平二级工时类型：一级节点有子级时取其子级，否则取自身 */
export function flattenWorkTypes(workTypes: WorkTypeNode[]): WorkTypeNode[] {
  return workTypes.flatMap((node) => (node.children?.length ? node.children : [node]));
}

/** 下拉用的扁平选项：有子级的节点产出子级（父名 / 子名），无子级产出自身 */
export function buildWorkTypeOptions(workTypes: WorkTypeNode[]): { id: string; name: string }[] {
  return workTypes.flatMap((node) =>
    node.children?.length
      ? node.children.map((child) => ({ id: child.id, name: `${node.name} / ${child.name}` }))
      : [{ id: node.id, name: node.name }],
  );
}
