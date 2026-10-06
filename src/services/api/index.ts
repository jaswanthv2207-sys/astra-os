/**
 * HTTP transport layer: the single place that talks to the backend.
 *
 *   services/api/client.ts   – configured fetch wrapper (base URL, auth
 *                              headers, timeout, typed error handling)
 *   services/api/endpoints.ts – endpoint paths
 *
 * Feature folders under `src/services/<resource>` export React Query
 * hooks (`useQuery` / `useMutation`) built on this client.
 */
export {};
