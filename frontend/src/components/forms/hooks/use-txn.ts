import { useMutation } from "@tanstack/react-query";
import { postTransaction, TransactionPayload } from "@/lib/api/txn";

export function useTxn() {
  return useMutation<void, unknown, TransactionPayload>({
    mutationFn: (payload: TransactionPayload) => postTransaction(payload),
  });
}
