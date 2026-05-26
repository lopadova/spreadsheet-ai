import { useEffect } from 'react';
import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
    type UseQueryResult,
} from '@tanstack/react-query';
import {
    addColumn,
    deleteColumn,
    getReview,
    getSuggestions,
    updateColumn,
    type AiColumn,
    type ColumnInput,
    type ReviewResponse,
    type SuggestionsResponse,
} from '../api/client';
import { queryKeys } from '../api/queryClient';
import { sharedCellStore } from '../store/sharedCellStore';
import type { SubscribableCellStore } from '../store/cells';

/**
 * Loads a review by preset and seeds the shared cell store from its `cells`.
 * The store seed runs as an effect so it stays out of render and re-seeds
 * whenever the underlying review data changes.
 */
export function useReview(
    preset: string,
    store: SubscribableCellStore = sharedCellStore,
): UseQueryResult<ReviewResponse> {
    const query = useQuery({
        queryKey: queryKeys.review(preset),
        queryFn: () => getReview(preset),
    });

    const cells = query.data?.cells;
    useEffect(() => {
        if (cells) store.bulkLoad(cells);
    }, [cells, store]);

    return query;
}

export function useSuggestions(
    preset: string,
    enabled = true,
): UseQueryResult<SuggestionsResponse> {
    return useQuery({
        queryKey: queryKeys.suggestions(preset),
        queryFn: () => getSuggestions(preset),
        enabled,
    });
}

// ---- Column mutations (used fully in M4/M5) --------------------------

export function useAddColumn(
    preset: string,
    reviewId: number | undefined,
): UseMutationResult<AiColumn, Error, ColumnInput> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (col: ColumnInput) => {
            if (reviewId == null) throw new Error('Review not loaded');
            return addColumn(reviewId, col);
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: queryKeys.review(preset) });
        },
    });
}

export function useUpdateColumn(
    preset: string,
    reviewId: number | undefined,
): UseMutationResult<AiColumn, Error, { index: number; col: Partial<ColumnInput> }> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ index, col }: { index: number; col: Partial<ColumnInput> }) => {
            if (reviewId == null) throw new Error('Review not loaded');
            return updateColumn(reviewId, index, col);
        },
        // Optimistic: patch the cached column in place, roll back on error.
        onMutate: async ({ index, col }) => {
            await qc.cancelQueries({ queryKey: queryKeys.review(preset) });
            const previous = qc.getQueryData<ReviewResponse>(queryKeys.review(preset));
            if (previous) {
                qc.setQueryData<ReviewResponse>(queryKeys.review(preset), {
                    ...previous,
                    columns: previous.columns.map((c) =>
                        c.index === index ? { ...c, ...col } : c,
                    ),
                });
            }
            return { previous };
        },
        onError: (_err, _vars, context) => {
            const ctx = context as { previous?: ReviewResponse } | undefined;
            if (ctx?.previous) {
                qc.setQueryData(queryKeys.review(preset), ctx.previous);
            }
        },
        onSettled: () => {
            void qc.invalidateQueries({ queryKey: queryKeys.review(preset) });
        },
    });
}

export function useDeleteColumn(
    preset: string,
    reviewId: number | undefined,
): UseMutationResult<void, Error, number> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (index: number) => {
            if (reviewId == null) throw new Error('Review not loaded');
            return deleteColumn(reviewId, index);
        },
        onMutate: async (index: number) => {
            await qc.cancelQueries({ queryKey: queryKeys.review(preset) });
            const previous = qc.getQueryData<ReviewResponse>(queryKeys.review(preset));
            if (previous) {
                qc.setQueryData<ReviewResponse>(queryKeys.review(preset), {
                    ...previous,
                    columns: previous.columns.filter((c) => c.index !== index),
                });
            }
            return { previous };
        },
        onError: (_err, _vars, context) => {
            const ctx = context as { previous?: ReviewResponse } | undefined;
            if (ctx?.previous) {
                qc.setQueryData(queryKeys.review(preset), ctx.previous);
            }
        },
        onSettled: () => {
            void qc.invalidateQueries({ queryKey: queryKeys.review(preset) });
        },
    });
}
