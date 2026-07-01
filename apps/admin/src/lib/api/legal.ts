import { apiFetch } from '../api';

export type PrivacyPolicy = {
  id: string;
  key: string;
  title: string;
  version: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export function getPrivacyPolicy() {
  return apiFetch<PrivacyPolicy>('/legal/privacy-policy');
}

export type UpdatePrivacyPolicyInput = {
  title?: string;
  version: string;
  content: string;
};

export function updatePrivacyPolicy(input: UpdatePrivacyPolicyInput) {
  return apiFetch<PrivacyPolicy>('/legal/privacy-policy', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
