import { useQuery, QueryClient } from "@tanstack/react-query";

interface BatchRequest {
  endpoint: string;
  method?: string;
}

interface BatchResult {
  endpoint: string;
  data?: any;
  error?: string;
  status: number;
}

interface BatchResponse {
  results: BatchResult[];
}

export async function fetchBatch(requests: BatchRequest[]): Promise<BatchResponse> {
  const response = await fetch("/api/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  
  if (!response.ok) {
    throw new Error("Batch request failed");
  }
  
  return response.json();
}

export function useBatchFetch(endpoints: string[], enabled: boolean = true) {
  return useQuery({
    queryKey: ["batch", ...endpoints],
    queryFn: async () => {
      const requests = endpoints.map(endpoint => ({ endpoint }));
      const response = await fetchBatch(requests);
      
      const dataMap: Record<string, any> = {};
      for (const result of response.results) {
        if (result.status === 200 && result.data !== undefined) {
          dataMap[result.endpoint] = result.data;
        }
      }
      
      return dataMap;
    },
    enabled,
    staleTime: 30000,
  });
}

export function prefetchScheduleData(queryClient: QueryClient) {
  const endpoints = [
    "/api/staff",
    "/api/clients", 
    "/api/template",
    "/api/client-locations",
    "/api/schools",
  ];
  
  return queryClient.prefetchQuery({
    queryKey: ["batch", ...endpoints],
    queryFn: async () => {
      const requests = endpoints.map(endpoint => ({ endpoint }));
      const response = await fetchBatch(requests);
      
      const dataMap: Record<string, any> = {};
      for (const result of response.results) {
        if (result.status === 200 && result.data !== undefined) {
          dataMap[result.endpoint] = result.data;
          queryClient.setQueryData([result.endpoint], result.data);
        }
      }
      
      return dataMap;
    },
  });
}
