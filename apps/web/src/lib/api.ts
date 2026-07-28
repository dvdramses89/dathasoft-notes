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

// ---------------- Categorias ----------------

export interface CategoryNode {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  position: number;
  parentId: string | null;
  children: CategoryNode[];
}

export function getCategories(): Promise<CategoryNode[]> {
  return request<CategoryNode[]>('/categories');
}

export function createCategory(input: {
  name: string;
  parentId?: string | null;
}): Promise<{ id: string }> {
  const body: { name: string; parentId?: string } = { name: input.name };
  if (input.parentId) {
    body.parentId = input.parentId;
  }
  return request<{ id: string }>('/categories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// subtree = la carpeta y toda su estructura; single = solo la carpeta (las hijas suben).
export type TreeMode = 'subtree' | 'single';

export function updateCategory(
  id: string,
  input: { name?: string; color?: string; icon?: string; position?: number },
): Promise<{ id: string }> {
  return request<{ id: string }>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteCategory(id: string, mode: TreeMode): Promise<{ deleted: number }> {
  return request<{ deleted: number }>(`/categories/${id}?mode=${mode}`, {
    method: 'DELETE',
  });
}

export { API_URL };
