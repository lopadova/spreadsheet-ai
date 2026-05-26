import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30_000,
                gcTime: 5 * 60_000,
                retry: 1,
                refetchOnWindowFocus: false,
            },
        },
    });
}

/** Query keys used across the app. */
export const queryKeys = {
    review: (preset: string) => ['review', preset] as const,
    suggestions: (preset: string) => ['suggestions', preset] as const,
};
