export class WorkTypeDto {
  id: string;
  name: string;
  level: number;
  parentId?: string;
  children?: WorkTypeDto[];
}
