import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

/**
 * Singleton pg Pool shared across the application.
 * Configuration is read from environment variables.
 */
const pool = new Pool({
	host: process.env.DB_HOST || 'localhost',
	port: parseInt(process.env.DB_PORT || '5432', 10),
	database: process.env.DB_NAME,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	ssl: { rejectUnauthorized: false },
	max: 10,               // max pool connections
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
	console.error('[DB] Unexpected pool error:', err.message);
});

export default pool;
