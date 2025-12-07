import { protectedApiClient } from "./protected-client";

export interface SubmitFeedbackPayload {
  message: string;
  category?: string;
  metadata?: Record<string, any>;
}

export async function submitFeedback(
  payload: SubmitFeedbackPayload
): Promise<void> {
  await protectedApiClient("/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
