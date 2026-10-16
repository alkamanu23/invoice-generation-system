import pkg from "pg";

const { Pool } = pkg;
const pool = new Pool({
  host: 'database-1.cgbvefr6jmnj.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'alligator',
  password: process.env.DB_PASSWORD,  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

export default pool;