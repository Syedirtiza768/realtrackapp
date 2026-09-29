import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '/app/.env' });
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
const result = await pool.query(`
  select pid, state, wait_event_type, wait_event,
         now() - query_start as query_age,
         now() - xact_start as transaction_age,
         left(query, 220) as query
  from pg_stat_activity
  where datname = current_database() and pid <> pg_backend_pid()
  order by query_start
`);
console.log(JSON.stringify(result.rows, null, 2));
await pool.end();
