// Cliente HTTP minimo para hablar con la API de DTNotes.
// La URL base se toma del .env (VITE_API_URL); en dev apunta a NestJS en :3000.

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export interface HealthResponse {
  status: string;
  service: string;
  env: string;
  timestamp: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) {
    throw new Error(`La API respondio con HTTP ${res.status}`);
  }
  return (await res.json()) as HealthResponse;
}

export { API_URL };
