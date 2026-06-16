import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { usersApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/api/query-keys';
import { useAuth } from '../../lib/auth/use-auth';

const DEBOUNCE_DELAY = 300;

interface UseUserSearchOptions {
  query: string;
  enabled?: boolean;
}

export function useUserSearch({ query, enabled = true }: UseUserSearchOptions) {
  const { accessToken } = useAuth();
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [query]);

  return useQuery({
    queryKey: queryKeys.users.search(debouncedQuery),
    queryFn: async () => {
      if (!accessToken) return [];
      // termo vazio → backend retorna todos (limitado). Sem gate de tamanho.
      return usersApi.search(debouncedQuery, { token: accessToken });
    },
    enabled: enabled && Boolean(accessToken),
    staleTime: 60_000, // cacheia o termo por 1min (evita refetch ao voltar)
  });
}
