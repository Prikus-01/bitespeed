import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Reads schema.sql and applies it to the configured PostgreSQL database.
 * Run with: npm run setup:db
 */
const setupDatabase = async () => {
  const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:      true,
  });

  try {
    console.log('⏳  Connecting to database...');
    const schemaSQL = readFileSync(join(__dirname, '../sql/schema.sql'), 'utf8');
    await pool.query(schemaSQL);
    console.log('✅  Database schema applied successfully.');
  } catch (err) {
    console.error('❌  Database setup failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

setupDatabase();
