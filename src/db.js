// db.js

import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;

// Import this later whenever we need queries; Future ken will use this
// import pool from './db.js';
// const result = await pool.query('SELECT * FROM users');
// console.log(result.rows);
