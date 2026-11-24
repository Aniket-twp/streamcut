/** Reads a JSON API response and turns HTTP/HTML failures into readable errors. */
export async function readJson<T = unknown>(response: Response): Promise<T> {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    throw new Error(
      'This needs the local server. Run "npm run dev" in the project — the production build has no link backend.',
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message || 'That request failed.');
  }
  return data as T;
}
