import { apiFetch } from '../api';

export type ServiceCategory = {
  id: string;
  slug: string;
  nameEn: string;
  nameSi: string | null;
  nameTa: string | null;
  isActive: boolean;
};

export function listCategories() {
  return apiFetch<ServiceCategory[]>('/categories');
}
