import { computed, shallowRef } from 'vue';

import { getProjects, getWorkTypes } from '../api/timesheet-client';
import type { Project, WorkTypeNode } from '../types/timesheet';
import { getProjectsCacheKey, getSessionCache, getWorkTypesCacheKey, setSessionCache } from '../utils/cache';
import { buildWorkTypeGroups, findWorkTypeById } from '../utils/work-types';
import type { WorkTypeGroup } from '../utils/work-types';

export function useProjectCatalog() {
  const projects = shallowRef<Project[]>([]);
  const isProjectsLoading = shallowRef(false);
  const workTypeMap = shallowRef<Record<string, WorkTypeNode[]>>({});

  async function loadProjectsByUser(userId: string): Promise<void> {
    const cacheKey = getProjectsCacheKey(userId);
    const cached = getSessionCache<Project[]>(cacheKey);
    if (cached) {
      projects.value = cached;
      return;
    }

    isProjectsLoading.value = true;
    try {
      const data = await getProjects();
      projects.value = data;
      setSessionCache(cacheKey, data);
    } finally {
      isProjectsLoading.value = false;
    }
  }

  async function loadWorkTypesByProject(projectId: string): Promise<WorkTypeNode[]> {
    const cacheKey = getWorkTypesCacheKey(projectId);
    const cached = getSessionCache<WorkTypeNode[]>(cacheKey);
    if (cached) {
      workTypeMap.value = { ...workTypeMap.value, [projectId]: cached };
      return cached;
    }

    const data = await getWorkTypes(projectId);
    workTypeMap.value = { ...workTypeMap.value, [projectId]: data };
    setSessionCache(cacheKey, data);
    return data;
  }

  function getWorkTypesForProject(projectId: string): WorkTypeNode[] {
    return workTypeMap.value[projectId] ?? [];
  }

  function getWorkTypeGroups(workTypes: WorkTypeNode[]): WorkTypeGroup[] {
    return buildWorkTypeGroups(workTypes);
  }

  function findWorkType(groups: WorkTypeGroup[], itemId: string) {
    return findWorkTypeById(groups, itemId);
  }

  return {
    projects,
    isProjectsLoading,
    workTypeMap,
    loadProjectsByUser,
    loadWorkTypesByProject,
    getWorkTypesForProject,
    getWorkTypeGroups,
    findWorkType,
  };
}
