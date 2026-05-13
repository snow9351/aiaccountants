import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CompanyStore {
  activeOrgId: string;
  setActiveOrgId: (id: string) => void;
}

export const useCompanyStore = create<CompanyStore>()(
  persist(
    (set) => ({
      activeOrgId: '',
      setActiveOrgId: (id: string) => set({ activeOrgId: id }),
    }),
    { name: 'ai-accountants-org' }
  )
);
