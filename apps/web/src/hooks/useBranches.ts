import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => api.getBranches(),
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, from }: { name: string; from?: string }) =>
      api.createBranch(name, from),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

export function useCheckoutBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (branch: string) => api.checkoutBranch(branch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
