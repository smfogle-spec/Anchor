import { useState, useEffect, useCallback } from "react";
import { useQuery, UseQueryResult } from "@tanstack/react-query";

interface ProgressiveDataOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  priorityOrder?: string[];
}

interface DataLoadState {
  isLoading: boolean;
  loadedItems: number;
  totalItems: number;
  progress: number;
  currentBatch: string;
}

export function useProgressiveData<T>(
  queryKey: string[],
  fetchFn: () => Promise<T[]>,
  options: ProgressiveDataOptions = {}
): UseQueryResult<T[]> & { loadState: DataLoadState } {
  const { batchSize = 50, delayBetweenBatches = 0 } = options;
  
  const [loadState, setLoadState] = useState<DataLoadState>({
    isLoading: false,
    loadedItems: 0,
    totalItems: 0,
    progress: 0,
    currentBatch: "",
  });

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      setLoadState(prev => ({ ...prev, isLoading: true, currentBatch: queryKey[0] }));
      
      const data = await fetchFn();
      
      setLoadState({
        isLoading: false,
        loadedItems: data.length,
        totalItems: data.length,
        progress: 100,
        currentBatch: "",
      });
      
      return data;
    },
  });

  return { ...query, loadState };
}

interface MultiQueryState {
  isLoading: boolean;
  progress: number;
  currentQuery: string;
  completedQueries: string[];
  errors: string[];
}

export function useMultiQueryProgress(
  queries: { key: string; isLoading: boolean; isError: boolean }[]
): MultiQueryState {
  const completedQueries = queries
    .filter(q => !q.isLoading && !q.isError)
    .map(q => q.key);
  
  const loadingQuery = queries.find(q => q.isLoading);
  const errorQueries = queries.filter(q => q.isError).map(q => q.key);
  
  const progress = queries.length > 0 
    ? (completedQueries.length / queries.length) * 100 
    : 0;

  return {
    isLoading: queries.some(q => q.isLoading),
    progress,
    currentQuery: loadingQuery?.key || "",
    completedQueries,
    errors: errorQueries,
  };
}

export function useDataReadiness(dependencies: boolean[]): {
  isReady: boolean;
  readyCount: number;
  totalCount: number;
  progress: number;
} {
  const readyCount = dependencies.filter(Boolean).length;
  const totalCount = dependencies.length;
  const progress = totalCount > 0 ? (readyCount / totalCount) * 100 : 0;

  return {
    isReady: dependencies.every(Boolean),
    readyCount,
    totalCount,
    progress,
  };
}
