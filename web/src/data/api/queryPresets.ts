/**
 * Shared React Query cache presets for relatively static reference data
 * (branches, categories, employees, courier parties). All mutations on these
 * entities already call `queryClient.invalidateQueries(...)` immediately.
 */
export const REFERENCE_QUERY_OPTIONS = {
  staleTime: 1000 * 60 * 15,
  gcTime: 1000 * 60 * 30,
} as const;
