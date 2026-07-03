import { apiFetch } from '../api';

export type LanguageCode = 'EN' | 'SI' | 'TA';

export type HomeownerProfile = {
  userId: string;
  locationText: string | null;
  city: string | null;
  district: string | null;
  postalCode: string | null;
  preferredLanguage: LanguageCode;
  createdAt: string;
  updatedAt: string;
};

export type TradesmanProfile = {
  userId: string;
  bio: string | null;
  yearsExperience: number;
  hourlyRate: number | null;
  locationText: string | null;
  city: string | null;
  district: string | null;
  serviceRadiusKm: number;
  preferredLanguage: LanguageCode;
  certifications: string[];
  vehicles: string[];
  isVerified: boolean;
  backgroundChecked: boolean;
  avgRating: number;
  ratingCount: number;
  jobsCompleted: number;
  skills: Array<{
    skillId: string;
    skill: { id: string; slug: string; nameEn: string };
  }>;
  createdAt: string;
  updatedAt: string;
};

export type MyProfile = {
  id: string;
  name: string;
  email: string;
  userType: 'HOMEOWNER' | 'TRADESMAN' | null;
  homeownerProfile: HomeownerProfile | null;
  tradesmanProfile: TradesmanProfile | null;
};

export type UpsertHomeownerBody = {
  locationText?: string;
  city?: string;
  district?: string;
  postalCode?: string;
  preferredLanguage: LanguageCode;
};

export type UpsertTradesmanBody = {
  bio?: string;
  yearsExperience: number;
  hourlyRate?: number;
  locationText?: string;
  city?: string;
  district?: string;
  serviceRadiusKm: number;
  preferredLanguage: LanguageCode;
  skillIds?: string[];
  certifications?: string[];
  vehicles?: string[];
};

export function getMyProfile() {
  return apiFetch<MyProfile>('/profiles/me');
}

export function upsertHomeownerProfile(body: UpsertHomeownerBody) {
  return apiFetch<HomeownerProfile>('/profiles/me/homeowner', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function upsertTradesmanProfile(body: UpsertTradesmanBody) {
  return apiFetch<TradesmanProfile>('/profiles/me/tradesman', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export type Skill = {
  id: string;
  slug: string;
  nameEn: string;
  nameSi: string | null;
  nameTa: string | null;
  categoryId: string;
};

export function listSkills(categoryId?: string) {
  const q = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
  return apiFetch<Skill[]>(`/skills${q}`);
}

// ─── Public tradesman directory ─────────────────────────────────────────────

export type TradesmanListItem = {
  userId: string;
  name: string;
  image: string | null;
  primaryTrade: string | null;
  bio: string | null;
  city: string | null;
  district: string | null;
  yearsExperience: number;
  preferredLanguage: LanguageCode;
  avgRating: number;
  ratingCount: number;
  jobsCompleted: number;
  isVerified: boolean;
  skills: Array<{ id: string; nameEn: string }>;
};

export type TradesmanPublicProfile = TradesmanListItem & {
  locationText: string | null;
  hourlyRate: number | null;
  serviceRadiusKm: number;
  responseTimeMinutes: number;
  isAvailable: boolean;
  certifications: string[];
  vehicles: string[];
  // Presigned URLs for the tradesman's uploaded work photos.
  portfolio: string[];
};

export type TradesmenQuery = {
  page?: number;
  limit?: number;
  district?: string;
  categoryId?: string;
  skillId?: string;
};

export type Paginated<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; lastPage: number };
};

export function browseTradesmen(query: TradesmenQuery = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return apiFetch<Paginated<TradesmanListItem>>(
    `/profiles/tradesmen${qs ? `?${qs}` : ''}`,
  );
}

export function getTradesmanPublic(userId: string) {
  return apiFetch<TradesmanPublicProfile>(
    `/profiles/tradesmen/${encodeURIComponent(userId)}`,
  );
}
