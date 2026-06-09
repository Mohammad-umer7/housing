export function successResponse(data: unknown, meta?: unknown) {
  return {
    success: true,
    version: 'v1',
    timestamp: new Date().toISOString(),
    data,
    ...(meta !== undefined ? { meta } : {}),
  }
}

export function errorResponse(error: string, code?: number) {
  return {
    success: false,
    version: 'v1',
    timestamp: new Date().toISOString(),
    error,
    ...(code !== undefined ? { code } : {}),
  }
}
