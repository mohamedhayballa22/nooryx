import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateSKU, type UpdateSKUPayload } from "@/lib/api/settings/sku"

export function useUpdateSKU() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateSKUPayload) => updateSKU(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["inventory"],
      })
    },
  })
}
