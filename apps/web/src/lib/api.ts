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
  /** Documentos directos de la carpeta; permite saber si tiene contenido sin cargarlo. */
  documentCount: number;
  children: CategoryNode[];
}

export interface CategoryTreeResult {
  tree: CategoryNode[];
  rootDocumentCount: number;
}

export function getCategories(): Promise<CategoryTreeResult> {
  return request<CategoryTreeResult>('/categories');
}

export function createCategory(input: {
  name: string;
  parentId?: string | null;
  /** Nombre de color de Mantine (ver FOLDER_COLORS en theme.ts). */
  color?: string;
  /** Clave del catalogo de iconos (ver folderIcons.tsx). */
  icon?: string;
}): Promise<{ id: string }> {
  const body: { name: string; parentId?: string; color?: string; icon?: string } = {
    name: input.name,
  };
  if (input.parentId) {
    body.parentId = input.parentId;
  }
  if (input.color) {
    body.color = input.color;
  }
  if (input.icon) {
    body.icon = input.icon;
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

export function moveCategory(
  id: string,
  parentId: string | null,
  mode: TreeMode,
): Promise<{ id: string }> {
  return request<{ id: string }>(`/categories/${id}/move`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId, mode }),
  });
}

export function reorderCategories(
  parentId: string | null,
  orderedIds: string[],
): Promise<{ reordered: number }> {
  return request<{ reordered: number }>('/categories/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ parentId, orderedIds }),
  });
}

// ---------------- Tags ----------------

/** Tag tal y como lo devuelve la API. `color` es un nombre de color de Mantine. */
export interface Tag {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
}

/** En el listado general, cada tag trae en cuántos documentos vivos se usa. */
export interface TagWithCount extends Tag {
  documentCount: number;
}

export function getTags(): Promise<TagWithCount[]> {
  return request<TagWithCount[]>('/tags');
}

export function createTag(input: { name: string; color?: string }): Promise<Tag> {
  return request<Tag>('/tags', { method: 'POST', body: JSON.stringify(input) });
}

export function updateTag(id: string, input: { name?: string; color?: string }): Promise<Tag> {
  return request<Tag>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteTag(id: string): Promise<{ deleted: number }> {
  return request<{ deleted: number }>(`/tags/${id}`, { method: 'DELETE' });
}

/**
 * Vincula un tag al documento POR NOMBRE: la API lo reutiliza si ya existe (sin
 * distinguir mayusculas) y lo crea si no. Devuelve los tags del documento.
 */
export function attachTag(documentId: string, name: string): Promise<Tag[]> {
  return request<Tag[]>(`/documents/${documentId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

/** Quita el tag del documento; el tag sigue existiendo. */
export function detachTag(documentId: string, tagId: string): Promise<{ removed: number }> {
  return request<{ removed: number }>(`/documents/${documentId}/tags/${tagId}`, {
    method: 'DELETE',
  });
}

// ---------------- Documentos ----------------

/** Campos que comparten las dos formas de documento que devuelve la API. */
interface DocumentBase {
  id: string;
  title: string;
  categoryId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  /** Tags del documento, ordenados por nombre. Vienen en las dos formas. */
  tags: Tag[];
}

/** Documento en un listado: sin el contenido, con un extracto para la vista previa. */
export interface DocumentListItem extends DocumentBase {
  excerpt: string;
}

/** Documento completo, con el contenido del editor. */
export interface DocumentFull extends DocumentBase {
  contentJson: unknown;
  contentText: string;
}

/**
 * Convierte la respuesta completa en un item de listado, para reflejar en la
 * cache local un documento recien creado, movido o guardado.
 *
 * El extracto canonico lo calcula la API; este recorte es una aproximacion para
 * que la vista previa no se quede vieja hasta el siguiente listado.
 */
export function toListItem(doc: DocumentFull): DocumentListItem {
  const { contentJson: _ignored, contentText, ...base } = doc;
  const text = contentText.trim();
  return { ...base, excerpt: text.length > 240 ? `${text.slice(0, 240)}…` : text };
}

/** Sin filtro = todos; null = solo los de la raiz; uuid = los de esa carpeta. */
export function getDocuments(categoryId?: string | null): Promise<DocumentListItem[]> {
  const query = categoryId === undefined ? '' : `?categoryId=${categoryId ?? 'root'}`;
  return request<DocumentListItem[]>(`/documents${query}`);
}

export function getDocument(id: string): Promise<DocumentFull> {
  return request<DocumentFull>(`/documents/${id}`);
}

export function createDocument(input: {
  title: string;
  categoryId?: string | null;
  contentJson?: unknown;
  contentText?: string;
}): Promise<DocumentFull> {
  const body: Record<string, unknown> = { title: input.title };
  if (input.categoryId) {
    body.categoryId = input.categoryId;
  }
  if (input.contentJson !== undefined) {
    body.contentJson = input.contentJson;
  }
  if (input.contentText !== undefined) {
    body.contentText = input.contentText;
  }
  return request<DocumentFull>('/documents', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateDocument(
  id: string,
  input: { title?: string; contentJson?: unknown; contentText?: string },
): Promise<DocumentFull> {
  return request<DocumentFull>(`/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function moveDocument(id: string, categoryId: string | null): Promise<DocumentFull> {
  return request<DocumentFull>(`/documents/${id}/move`, {
    method: 'PATCH',
    body: JSON.stringify({ categoryId }),
  });
}

export function deleteDocument(id: string): Promise<{ deleted: number }> {
  return request<{ deleted: number }>(`/documents/${id}`, { method: 'DELETE' });
}

export function reorderDocuments(
  categoryId: string | null,
  orderedIds: string[],
): Promise<{ reordered: number }> {
  return request<{ reordered: number }>('/documents/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ categoryId, orderedIds }),
  });
}

export { API_URL };
