import { useMutation } from "@tanstack/react-query";
import { submitFeedback, type SubmitFeedbackPayload } from "@/lib/api/feedback";

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (payload: SubmitFeedbackPayload) => submitFeedback(payload),
  });
}
