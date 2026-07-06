import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { table, select, filters, order, limit, countOnly } = await req.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = admin.from(table)
    q = countOnly
      ? q.select('*', { count: 'exact', head: true })
      : q.select(select ?? '*')
    for (const { fn, args } of (filters ?? [])) {
      q = q[fn](...(Array.isArray(args) ? args : [args]))
    }
    if (order) q = q.order(order.col, { ascending: order.asc ?? true })
    if (limit) q = q.limit(limit)
    const { data, error, count } = await q
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ data, count })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { table, values, upsert, onConflict } = await req.json()
    const rows = Array.isArray(values) ? values : [values]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = admin.from(table)
    if (upsert) {
      q = onConflict
        ? q.upsert(rows, { onConflict })
        : q.upsert(rows)
    } else {
      q = q.insert(rows)
    }
    const { data, error } = await q.select()
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ data })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { table, values, match } = await req.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = admin.from(table).update(values)
    for (const [col, val] of Object.entries(match as Record<string, unknown>)) {
      q = q.eq(col, val)
    }
    const { error } = await q
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { table, match } = await req.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = admin.from(table).delete()
    for (const [col, val] of Object.entries(match as Record<string, unknown>)) {
      q = q.eq(col, val)
    }
    const { error } = await q
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
