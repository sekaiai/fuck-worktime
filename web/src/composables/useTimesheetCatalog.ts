import { shallowRef } from 'vue';

import { ApiError } from '../api/request';
import { getProjects, getWorkTypes } from '../api/timesheet-client';
import type { Project, WorkTypeNode } from '../types/timesheet';
import {
  getProjectsCacheKey,
  getSessionCache,
  getWorkTypesCacheKey,
  setSessionCache,
} from '../utils/cache';

export function useTimesheetCatalog() {
  const projects = shallowRef<Project[]>([]);
  const isProjectsLoading = shallowRef(false);
  const workTypeMap = shallowRef<Record<string, WorkTypeNode[]>>({});

  async function loadProjects(userId: string): Promise<void> {
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

  async function loadWorkTypes(projectId: string): Promise<WorkTypeNode[]> {
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

  function getWorkTypesByProject(projectId: string): WorkTypeNode[] {
    return workTypeMap.value[projectId] ?? [];
  }

  function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof ApiError) {
      return error.message;
    }

    return fallback;
  }

  return {
    projects,
    isProjectsLoading,
    loadProjects,
    loadWorkTypes,
    getWorkTypesByProject,
    getErrorMessage,
  };
}
