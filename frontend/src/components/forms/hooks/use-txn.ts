import { useMutation, useQueryClient } from "@tanstack/react-query"
import { postTransaction, type TransactionPayload } from "@/lib/api/txn"
import { useState } from "react"
import {
  parseTransactionError,
  type ParsedError,
} from "@/lib/error-parser"

interface UseTxnOptions {
  invalidateQueries?: string[]
}

export function useTxn(options?: UseTxnOptions) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<ParsedError | null>(null)

  const mutation = useMutation({
    mutationFn: (payload: TransactionPayload) => {
      // Clear previous errors on a new mutation
      setError(null)
      return postTransaction(payload)
    },
    onSuccess: () => {
      // Invalidate specified queries to trigger refetch
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey: [queryKey] })
        })
      }
      // Clear any previous errors on success
      setError(null)
    },
    onError: (err: any) => {
      setError(parseTransactionError(err))
    },
  })

  return { ...mutation, error }
}
