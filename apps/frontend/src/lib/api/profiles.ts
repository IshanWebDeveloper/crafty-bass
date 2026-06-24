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
  isVerified: boolean;
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
