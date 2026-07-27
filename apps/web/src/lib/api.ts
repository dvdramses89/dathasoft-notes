// Cliente HTTP de DTNotes. La URL base viene del .env (VITE_API_URL).

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export interface HealthResponse {
  status: string;
  service: string;
  env: string;
  timestamp: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface LoginResult {
  accessToken: string;
  user: PublicUser;
}

/** Error con el status HTTP para poder distinguir 401, 409, etc. */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Token en memoria; se adjunta como Bearer en cada peticion.
let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

interface ApiErrorBody {
  message?: string | string[];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const body = (data ?? {}) as ApiErrorBody;
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(msg ?? `Error HTTP ${res.status}`, res.status);
  }

  return data as T;
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

export function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<PublicUser> {
  return request<PublicUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function login(input: { email: string; password: string }): Promise<LoginResult> {
  return request<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getMe(): Promise<PublicUser> {
  return request<PublicUser>('/auth/me');
}

export { API_URL };
