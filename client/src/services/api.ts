import axios, {
  AxiosError,
  isAxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

/**
 * Function to handle successful responses
 */
const handleRes = (res: AxiosResponse) => res;

/**
 * Function to handle errors
 */
const handleErr = (err: AxiosError) => {
  return Promise.reject(err);
};

export const api = axios.create({ withCredentials: true });

/**
 * Extract a human-readable message from a failed API call, hiding raw
 * `AxiosError` details from users. Prefers the server's `{ error }` body (e.g.
 * "User not found"), then a plain `Error`'s message, then the fallback.
 */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { error?: unknown } | undefined;
    return typeof data?.error === "string" ? data.error : fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * Add a request interceptor to the Axios instance.
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => config,
  (error: AxiosError) => handleErr(error),
);

/**
 * Add a response interceptor to the Axios instance.
 */
api.interceptors.response.use(
  (response: AxiosResponse) => handleRes(response),
  (error: AxiosError) => handleErr(error),
);
