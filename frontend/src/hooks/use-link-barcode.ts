import { useMutation, useQueryClient } from "@tanstack/react-query";
import { linkBarcode, type LinkBarcodePayload } from "@/lib/api/barcodes";

export function useLinkBarcode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LinkBarcodePayload) => linkBarcode(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barcode"]});
    },
  });
}
