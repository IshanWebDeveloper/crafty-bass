import { apiFetch } from '../api';
import type { LanguageCode } from './jobs';

export type ClassificationResult = {
  category: { id: string; slug: string; nameEn: string } | null;
  skills: Array<{ id: string; slug: string; nameEn: string }>;
  confidence: number;
  reasoning: string;
  model: string;
};

// Ask the backend (which proxies to the LLM classifier in the AI service) to
// suggest a category and skills for a job draft. Replaces the old client-side
// keyword heuristic in post-job-form.
export function classifyJob(input: {
  title: string;
  description: string;
  language: LanguageCode;
}) {
  return apiFetch<ClassificationResult>('/classify/job', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
