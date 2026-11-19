const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const DEFAULT_PAGE = 1;

interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): { data: T[]; pagination: PaginationMeta } {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function fetchPaginatedItems<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("limit", String(MAX_LIMIT));
  const items: T[] = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page += 1) {
    url.searchParams.set("page", String(page));
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Could not load ${url.pathname} (${response.status}).`);
    const result: ReturnType<typeof paginatedResponse<T>> = await response.json();
    items.push(...result.data);
    totalPages = result.pagination.totalPages;
  }
  return items;
}
