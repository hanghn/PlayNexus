import { api, apiErrorMessage } from "./api.ts";
import type { DMThreadInfo, ErrorMsg, UserAuth } from "@gamenite/shared";

const DM_API_URL = `/api/dm`;

/**
 * Open (or retrieve) a DM thread with another user. Throws an `Error` carrying
 * the server's message (e.g. "User not found") rather than a raw `AxiosError`.
 */
export const openDMThread = async (auth: UserAuth, withUsername: string): Promise<DMThreadInfo> => {
  try {
    const res = await api.post<DMThreadInfo | ErrorMsg>(`${DM_API_URL}/open`, {
      auth,
      payload: { withUsername },
    });
    if ("error" in res.data) throw new Error(res.data.error);
    return res.data;
  } catch (err) {
    throw new Error(apiErrorMessage(err, "User not found"));
  }
};

/**
 * Send a message to a DM thread.
 */
export const sendDMMessage = async (
  auth: UserAuth,
  threadId: string,
  text: string,
): Promise<DMThreadInfo> => {
  try {
    const res = await api.post<DMThreadInfo | ErrorMsg>(`${DM_API_URL}/${threadId}/message`, {
      auth,
      payload: { threadId, text },
    });
    if ("error" in res.data) throw new Error(res.data.error);
    return res.data;
  } catch (err) {
    throw new Error(apiErrorMessage(err, "Could not send message"));
  }
};

/**
 * Fetch a single DM thread by ID (must be a participant).
 */
export const getDMThread = async (auth: UserAuth, threadId: string): Promise<DMThreadInfo> => {
  const res = await api.get<DMThreadInfo | ErrorMsg>(`${DM_API_URL}/${threadId}`, {
    params: { username: auth.username, password: auth.password },
  });
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/**
 * Fetch all DM threads for a given user.
 */
export const getDMThreadList = async (username: string): Promise<DMThreadInfo[]> => {
  const res = await api.get<DMThreadInfo[] | ErrorMsg>(`${DM_API_URL}/list`, {
    params: { username },
  });
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};
