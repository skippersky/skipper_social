import { apiDelete, apiGet, apiPost, apiPut } from './http';
import {
  demoAssignTag,
  demoCreateTag,
  demoDeleteTag,
  demoRemoveTag,
  demoTags,
  demoUpdateTag,
  isMissingBackend
} from './demo';
import type { Tag } from '../types';

const TAGS = '/api/v1/tags';

export interface TagInput {
  name: string;
  color: string;
}

export async function getTags(): Promise<Tag[]> {
  try {
    return await apiGet<Tag[]>(TAGS);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoTags();
  }
}

export async function createTag(data: TagInput): Promise<Tag> {
  try {
    return await apiPost<Tag>(TAGS, data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCreateTag(data.name, data.color);
  }
}

export async function updateTag(id: string, data: Partial<TagInput>): Promise<Tag> {
  try {
    return await apiPut<Tag>(`${TAGS}/${id}`, data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUpdateTag(id, data);
  }
}

export async function deleteTag(id: string): Promise<void> {
  try {
    await apiDelete<void>(`${TAGS}/${id}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    demoDeleteTag(id);
  }
}

export async function assignTag(customerId: string, tagId: string): Promise<void> {
  try {
    await apiPost<void>(`/api/v1/customers/${customerId}/tags/${tagId}`, {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    demoAssignTag(customerId, tagId);
  }
}

export async function removeTag(customerId: string, tagId: string): Promise<void> {
  try {
    await apiDelete<void>(`/api/v1/customers/${customerId}/tags/${tagId}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    demoRemoveTag(customerId, tagId);
  }
}