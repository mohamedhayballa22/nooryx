import { createClient } from "next-sanity";

export const client = createClient({
  projectId: "1534ptox",
  dataset: "production",
  apiVersion: "2025-01-10",
  useCdn: true,
});
