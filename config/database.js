const { Pool } = require('pg');

const pool = new Pool({
  host: '103.127.31.183',
  port: 7311,
  database: 'contromoist_revamp_dev',
  user: 'postgres',
  // Add password when available
  // password: 'your_password_here',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test the connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};