import { apiFetch } from '../api';

// GET /categories returns a tree (root categories with nested children).
export type AdminCategory = {
  id: string;
  slug: string;
  nameEn: string;
  nameSi: string | null;
  nameTa: string | null;
  parentId: string | null;
  children?: AdminCategory[];
};

export function listCategories() {
  return apiFetch<AdminCategory[]>('/categories');
}

// The backend derives the slug from the name and stores it as nameEn; an
// optional parentId nests the category as a subcategory.
export function createCategory(body: { name: string; parentId?: string }) {
  return apiFetch<AdminCategory>('/categories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
