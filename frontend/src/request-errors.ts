/** Only static, allowlisted failure categories cross the client boundary. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number) { super('Request failed'); this.status = status; }
}

export function cloudFailure(error: unknown, operation: 'decision' | 'other' = 'other'): ApiError {
  if (operation === 'decision' && error !== null && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    if (value.code === 'P0001' && value.message === 'stale_decision') return new ApiError(409);
  }
  return new ApiError(0);
}
