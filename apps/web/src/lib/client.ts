import { NakamaClient } from "@nakama/client";
import { formatClientError } from "@nakama/core/api-error";

export const client = new NakamaClient({ baseUrl: "" });

export { formatClientError as formatError };
