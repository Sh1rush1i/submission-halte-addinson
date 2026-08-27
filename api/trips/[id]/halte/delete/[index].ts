import { createPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function getDb() {
  const connectionString =
    process.env['POSTGRES_URL'] ||
    process.env['DATABASE_URL'] ||
    process.env['POSTGRES_PRISMA_URL'] ||
    process.env['POSTGRES_URL_NON_POOLING'] ||
    process.env['DATABASE_URL_UNPOOLED'];

  if (!connectionString) {
    throw new Error(
      'Missing database connection string. Please set POSTGRES_URL or DATABASE_URL in Vercel Dashboard (Project Settings > Environment Variables).',
    );
  }

  return createPool({ connectionString });
}

function ensureHaltesArray(haltes: unknown): unknown[] {
  if (typeof haltes === 'string') {
    try {
      return JSON.parse(haltes);
    } catch {
      return [];
    }
  }
  return Array.isArray(haltes) ? haltes : [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).end();
  }

  const { id, index } = req.query;
  const tripId = Number(id);
  const idx = Number(index);

  if (isNaN(tripId) || isNaN(idx)) {
    return res.status(400).json({ error: 'Invalid trip id or halte index' });
  }

  try {
    const db = getDb();

    const { rows } = await db.sql`SELECT haltes FROM trips WHERE id = ${tripId}`;
    if (!rows.length) return res.status(404).json({ error: 'Trip not found' });

    const haltes = ensureHaltesArray(rows[0]['haltes']) as any[];
    if (idx < 0 || idx >= haltes.length) {
      return res.status(400).json({ error: 'Halte index out of range' });
    }

    haltes[idx] = {
      ...haltes[idx],
      waktuKedatangan: null,
      waktuKeberangkatan: null,
      penumpangNaik: null,
      penumpangTurun: null,
      penumpangTidakTerangkut: null,
    };

    const { rows: updated } = await db.sql`
      UPDATE trips SET haltes = ${JSON.stringify(haltes)} WHERE id = ${tripId}
      RETURNING id, kode_trip AS "kodeTrip", nama_surveyor AS "namaSurveyor",
                hari_tanggal AS "hariTanggal", nomor_kendaraan AS "nomorKendaraan", haltes
    `;

    const result = { ...updated[0], haltes: ensureHaltesArray(updated[0]['haltes']) };
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
