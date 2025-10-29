import { useQuery } from "@tanstack/react-query";
import { searchLocations } from "@/lib/api/search";
import { ApiError } from "@/lib/api/client";
import { Option } from "../searchable-autocomplete";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useLocationSearch(query: string) {
  const queryResult = useQuery({
    queryKey: ["search", "locations", query],
    queryFn: () => searchLocations(query),
    enabled: !!query,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
    select: (data: string[]): Option[] =>
      data.map((loc) => ({
        value: loc,
        label: loc,
      })),
  });

  const hasData = !!queryResult.data;
  const errorStatus = getErrorStatus(queryResult.error);

  return {
    ...queryResult,
    data: queryResult.data ?? [],
    hasData,
    errorStatus,
  };
}
