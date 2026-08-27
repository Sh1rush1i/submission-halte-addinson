import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function ensureHaltesArray(haltes: unknown): unknown[] {
  if (typeof haltes === 'string') {
    try { return JSON.parse(haltes); } catch { return []; }
  }
  return Array.isArray(haltes) ? haltes : [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).end();
  }

  const { id, index } = req.query;
  const tripId = Number(id);
  const idx = Number(index);

  if (isNaN(tripId) || isNaN(idx)) {
    return res.status(400).json({ error: 'Invalid trip id or halte index' });
  }

  try {
    const { rows } = await sql`SELECT haltes FROM trips WHERE id = ${tripId}`;
    if (!rows.length) return res.status(404).json({ error: 'Trip not found' });

    const haltes = ensureHaltesArray(rows[0].haltes) as any[];
    if (idx < 0 || idx >= haltes.length) {
      return res.status(400).json({ error: 'Halte index out of range' });
    }

    const body = req.body;
    const patch: Record<string, unknown> = {};
    if (body.waktuKedatangan !== undefined) patch.waktuKedatangan = body.waktuKedatangan;
    if (body.waktuKeberangkatan !== undefined) patch.waktuKeberangkatan = body.waktuKeberangkatan;
    if (body.penumpangNaik !== undefined) patch.penumpangNaik = Math.max(0, Number(body.penumpangNaik) || 0);
    if (body.penumpangTurun !== undefined) patch.penumpangTurun = Math.max(0, Number(body.penumpangTurun) || 0);
    if (body.penumpangTidakTerangkut !== undefined) patch.penumpangTidakTerangkut = Math.max(0, Number(body.penumpangTidakTerangkut) || 0);

    haltes[idx] = { ...haltes[idx], ...patch };

    const { rows: updated } = await sql`
      UPDATE trips SET haltes = ${JSON.stringify(haltes)} WHERE id = ${tripId}
      RETURNING id, kode_trip AS "kodeTrip", nama_surveyor AS "namaSurveyor",
                hari_tanggal AS "hariTanggal", nomor_kendaraan AS "nomorKendaraan", haltes
    `;

    const result = { ...updated[0], haltes: ensureHaltesArray(updated[0].haltes) };
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
