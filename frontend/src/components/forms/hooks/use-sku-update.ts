import { useMutation } from "@tanstack/react-query"
import { updateSKU, type updateSKUPayload } from "@/lib/api/settings/sku"

export function useUpdateSKU() {
  return useMutation({
    mutationFn: (payload: updateSKUPayload) => updateSKU(payload)
  })
}
