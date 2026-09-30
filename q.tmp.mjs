import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
console.log(JSON.stringify(await sql.query(process.argv[2])));
