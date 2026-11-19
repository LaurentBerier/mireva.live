require('dotenv').config();
const database = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.port !== '55322' || database.searchParams.get('schema') !== 'postiz') {
  throw new Error('Agency integration tests require the dedicated local Supabase database on port 55322');
}
