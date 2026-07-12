import { create } from 'zustand';

export type UserType = 'HOMEOWNER' | 'TRADESMAN' | null;

interface SessionStore {
  /**
   * The signed-in user's marketplace role, or `null` when signed out or not yet
   * chosen. This is the synchronous, app-wide source of truth the role-aware
   * header reads from. It's seeded from `useMe` (server state) and set
   * optimistically at sign-up so the UI is role-correct the instant the user
   * lands on their first page — before the `me` query refetches.
   */
  userType: UserType;
  setUserType: (userType: UserType) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  userType: null,
  setUserType: (userType) => set({ userType }),
}));
