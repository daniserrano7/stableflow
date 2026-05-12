const DEFAULT_API_BASE_URL = "http://localhost:3001/v1";

export const getApiBaseUrl = () => {
  return (process.env.STABLEFLOW_API_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
};

export const getApiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${getApiBaseUrl()}${normalizedPath}`;
};
