import { apiFetch } from '../api';

// The weighted sub-scores behind a recommendation (each already in [0, 1]),
// surfaced so the homeowner can see *why* a tradesman was suggested.
export type RecommendationReasons = {
  subScores: {
    reputation: number;
    proximity: number;
    completion: number;
    response: number;
  };
  breakdown: {
    reputation: number;
    proximity: number;
    completion: number;
    response: number;
  };
  verifiedBoost: number;
  matchedSkillCount: number;
};

export type JobRecommendation = {
  id: string;
  tradesmanId: string;
  score: number;
  rank: number;
  reasons: RecommendationReasons | null;
  createdAt: string;
  tradesman: {
    id: string;
    name: string;
    image: string | null;
    tradesmanProfile: {
      city: string | null;
      district: string | null;
      avgRating: number;
      ratingCount: number;
      jobsCompleted: number;
      isVerified: boolean;
      serviceRadiusKm: number;
    } | null;
  };
};

export function getJobRecommendations(jobId: string) {
  return apiFetch<JobRecommendation[]>(`/recommendations/jobs/${jobId}`);
}

export function refreshJobRecommendations(jobId: string) {
  return apiFetch<JobRecommendation[]>(
    `/recommendations/jobs/${jobId}/refresh`,
    { method: 'POST' },
  );
}
