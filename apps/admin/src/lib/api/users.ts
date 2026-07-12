import { apiFetch, buildQuery, type Paginated } from '../api';

export type Role = 'CUSTOMER' | 'SUPPORT' | 'ADMIN';
export type UserType = 'HOMEOWNER' | 'TRADESMAN';

export type Me = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  userType: UserType | null;
  phone: string | null;
};

export function getMe() {
  return apiFetch<Me>('/users/me');
}

// A user row from the admin list endpoint (GET /users).
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  userType: UserType | null;
  phone: string | null;
  banned: boolean;
  banReason: string | null;
  createdAt: string;
};

export type HomeownerProfileContext = {
  city: string | null;
  district: string | null;
  locationText: string | null;
};

export type TradesmanProfileContext = {
  city: string | null;
  district: string | null;
  yearsExperience: number;
  isVerified: boolean;
  backgroundChecked: boolean;
  avgRating: string | number;
  ratingCount: number;
  jobsCompleted: number;
};

// GET /admin/users/:id - the enriched detail shape (adds profile context).
export type UserDetail = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  phone: string | null;
  role: Role;
  userType: UserType | null;
  banned: boolean;
  banReason: string | null;
  createdAt: string;
  updatedAt: string;
  homeownerProfile: HomeownerProfileContext | null;
  tradesmanProfile: TradesmanProfileContext | null;
};

export type ListUsersParams = {
  page?: number;
  limit?: number;
  role?: Role;
  userType?: UserType;
  search?: string;
};

export function listUsers(params: ListUsersParams = {}) {
  return apiFetch<Paginated<AdminUser>>(`/users${buildQuery(params)}`);
}

export function getUser(id: string) {
  return apiFetch<UserDetail>(`/admin/users/${id}`);
}

export function banUser(id: string, reason?: string) {
  return apiFetch<{ message: string }>(`/admin/users/${id}/ban`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function unbanUser(id: string) {
  return apiFetch<{ message: string }>(`/admin/users/${id}/unban`, {
    method: 'POST',
  });
}

export function setUserRole(id: string, role: Role) {
  return apiFetch<unknown>(`/admin/users/${id}/role`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

export type CreateStaffInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
};

export function createUser(input: CreateStaffInput) {
  return apiFetch<{ id: string }>(`/admin/users`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
