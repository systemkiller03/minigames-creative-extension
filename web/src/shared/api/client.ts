const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/u, '') || '/api';

export class ApiError extends Error {
    readonly status: number;

    constructor(status: number) {
        super(`API request failed with status ${status}`);
        this.name = 'ApiError';
        this.status = status;
    }
}

export async function getApiData<T>(path: string, signal?: AbortSignal): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
        headers: {
            Accept: 'application/json',
        },
        ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
        throw new ApiError(response.status);
    }

    return response.json() as Promise<T>;
}
