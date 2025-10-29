import { useMutation, useQueryClient } from "@tanstack/react-query"
import { postTransaction, type TransactionPayload } from "@/lib/api/txn"

interface UseTxnOptions {
  invalidateQueries?: string[]
}

export function useTxn(options?: UseTxnOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: TransactionPayload) => postTransaction(payload),
    onSuccess: () => {
      // Invalidate specified queries to trigger refetch
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey: [queryKey] })
        })
      }
    },
  })
}
