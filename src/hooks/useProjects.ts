import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Project, ProjectPhase } from '@/integrations/supabase/types';

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-1', org_id: 'mock', name: 'Platform Redesign 2024',
    customer_id: '1', status: 'active', project_type: 'fixed_price',
    start_date: '2024-01-15', end_date: '2024-06-30',
    budget_amount: 85000, actual_cost: 42500, revenue_amount: 85000,
    percent_complete: 50, description: 'Full platform UI/UX and architecture overhaul',
    manager_id: null,
    created_at: '2024-01-15T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
  {
    id: 'proj-2', org_id: 'mock', name: 'API Integration Sprint',
    customer_id: '2', status: 'active', project_type: 'time_and_materials',
    start_date: '2024-03-01', end_date: '2024-04-30',
    budget_amount: 32000, actual_cost: 18400, revenue_amount: 22000,
    percent_complete: 65, description: 'Third-party API integrations for TechFlow',
    manager_id: null,
    created_at: '2024-03-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
  {
    id: 'proj-3', org_id: 'mock', name: 'Q1 Consulting Retainer',
    customer_id: '3', status: 'completed', project_type: 'fixed_price',
    start_date: '2024-01-01', end_date: '2024-03-31',
    budget_amount: 24600, actual_cost: 19200, revenue_amount: 24600,
    percent_complete: 100, description: 'Quarterly strategic consulting for Meridian',
    manager_id: null,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-03-31T00:00:00Z',
  },
  {
    id: 'proj-4', org_id: 'mock', name: 'Data Analytics Dashboard',
    customer_id: '5', status: 'planning', project_type: 'fixed_price',
    start_date: '2024-05-01', end_date: '2024-07-31',
    budget_amount: 45000, actual_cost: 0, revenue_amount: 0,
    percent_complete: 0, description: 'Real-time analytics dashboard for CloudBase',
    manager_id: null,
    created_at: '2024-04-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
];

export function useProjects(filters?: { status?: string }) {
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: async (): Promise<Project[]> => {
      if (!isSupabaseConfigured) {
        if (filters?.status) return MOCK_PROJECTS.filter(p => p.status === filters.status);
        return MOCK_PROJECTS;
      }
      let q = supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (filters?.status) q = q.eq('status', filters.status);
      const { data, error } = await q;
      if (error) return MOCK_PROJECTS;
      return data as Project[];
    },
    placeholderData: MOCK_PROJECTS,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async (): Promise<Project | null> => {
      if (!isSupabaseConfigured) return MOCK_PROJECTS.find(p => p.id === id) ?? null;
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
      if (error) return null;
      return data as Project;
    },
    enabled: !!id,
  });
}

export function useProjectPhases(projectId: string) {
  return useQuery({
    queryKey: ['project_phases', projectId],
    queryFn: async (): Promise<ProjectPhase[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('phase_order');
      if (error) return [];
      return data as ProjectPhase[];
    },
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Project>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Project;
      }
      const { data, error } = await supabase.from('projects').insert(input as never).select().single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      if (!isSupabaseConfigured) return { id, ...updates } as Project;
      const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}
