type Filter = { fn: string; args: unknown[] }

export async function queryDB<T = unknown>(
  table: string,
  opts: {
    select?: string
    filters?: Filter[]
    order?: { col: string; asc?: boolean }
    limit?: number
  } = {}
): Promise<T[]> {
  const res = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, ...opts }),
    cache: 'no-store',
  })
  const { data, error } = await res.json()
  if (error) throw new Error(error)
  return data ?? []
}

export async function countDB(
  table: string,
  filters: Filter[] = []
): Promise<number> {
  const res = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, filters, countOnly: true }),
    cache: 'no-store',
  })
  const { count, error } = await res.json()
  if (error) return 0
  return count ?? 0
}

export async function updateDB(
  table: string,
  values: Record<string, unknown>,
  match: Record<string, unknown>
): Promise<void> {
  const res = await fetch('/api/db', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, values, match }),
  })
  const { error } = await res.json()
  if (error) throw new Error(error)
}

export async function insertDB<T = unknown>(
  table: string,
  values: Record<string, unknown> | Record<string, unknown>[]
): Promise<T[]> {
  const res = await fetch('/api/db', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, values }),
  })
  const { data, error } = await res.json()
  if (error) throw new Error(error)
  return data ?? []
}

export async function upsertDB<T = unknown>(
  table: string,
  values: Record<string, unknown> | Record<string, unknown>[],
  onConflict?: string
): Promise<T[]> {
  const res = await fetch('/api/db', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, values, upsert: true, onConflict }),
  })
  const { data, error } = await res.json()
  if (error) throw new Error(error)
  return data ?? []
}

export async function deleteDB(
  table: string,
  match: Record<string, unknown>
): Promise<void> {
  const res = await fetch('/api/db', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, match }),
  })
  const { error } = await res.json()
  if (error) throw new Error(error)
}
