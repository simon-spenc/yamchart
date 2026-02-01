import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
    staleTime: Infinity, // Config rarely changes
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000, // Check health every 30s
  });
}
