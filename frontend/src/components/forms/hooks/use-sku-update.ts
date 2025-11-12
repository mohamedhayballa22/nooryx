import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateSKU, type updateSKUPayload } from "@/lib/api/settings/sku"

export function useUpdateSKU() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: updateSKUPayload) => updateSKU(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["inventory"],
      })
    },
  })
}
