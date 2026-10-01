import type { PoolClient } from 'pg';
export async function initialize(db: PoolClient) {
    await db.query(`CREATE TABLE IF NOT EXISTS settlement_manifests (
 chain_id integer NOT NULL, season text NOT NULL, manifest text NOT NULL UNIQUE,
 distributor text NOT NULL, token text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(chain_id,season));
 CREATE TABLE IF NOT EXISTS settlement_transactions (
 manifest text NOT NULL REFERENCES settlement_manifests(manifest), payment_index integer NOT NULL,
 attempt integer NOT NULL, chain_id integer NOT NULL, sender text NOT NULL, nonce bigint NOT NULL,
 hash text NOT NULL UNIQUE, raw_transaction text NOT NULL, gas_budget numeric(78,0) NOT NULL,
 state text NOT NULL CHECK(state IN ('signed','confirmed','reverted')),
 receipt_block bigint, receipt_hash text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(manifest,payment_index,attempt), UNIQUE(chain_id,sender,nonce));`);
}
export async function exclusive<T>(db: PoolClient, key: string, work: () => Promise<T>): Promise<T> {
    const lock = await db.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [key]);
    if (!lock.rows[0].locked)
        throw Error('Settlement executor already running');
    try {
        return await work();
    }
    finally {
        await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [key]);
    }
}
export async function bindManifest(db: PoolClient, p: {
    chainId: number;
    season: string;
    manifestHash: string;
    distributor: string;
    token: string;
}) {
    await db.query('INSERT INTO settlement_manifests(chain_id,season,manifest,distributor,token) VALUES($1,$2,$3,$4,$5) ON CONFLICT(chain_id,season) DO NOTHING', [p.chainId, p.season, p.manifestHash, p.distributor, p.token]);
    const result = await db.query('SELECT * FROM settlement_manifests WHERE chain_id=$1 AND season=$2', [p.chainId, p.season]);
    const row = result.rows[0];
    if (!row || row.manifest !== p.manifestHash || row.distributor !== p.distributor || row.token !== p.token)
        throw Error('A different distribution is already registered for this season');
}
