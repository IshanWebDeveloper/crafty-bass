import { apiFetch } from '../api';

export type Me = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: 'CUSTOMER' | 'SUPPORT' | 'ADMIN';
  userType: 'HOMEOWNER' | 'TRADESMAN' | null;
  phone: string | null;
};

export function getMe() {
  return apiFetch<Me>('/users/me');
}
