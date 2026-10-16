import pool from './db';
import fs from 'fs';
import path from 'path';

export async function initDb() {
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');

  const statements = schemaSQL
    .replace(/CREATE TABLE\s+(?!IF NOT EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ')
    .split(';')
    .map(s => s.trim())
    .filter(stmt => stmt.length > 0);

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (err: any) {
      console.error(`Error executing statement: ${stmt}`);
      throw err;
    }
  }
}

export async function clearTables() {
  const dropQuery = `
    DROP TABLE IF EXISTS creditNoteLine CASCADE;
    DROP TABLE IF EXISTS debitNoteLine CASCADE;
    DROP TABLE IF EXISTS credit_note CASCADE;
    DROP TABLE IF EXISTS debit_note CASCADE;

    DROP TABLE IF EXISTS conditions CASCADE;
    DROP TABLE IF EXISTS line_responses CASCADE;
    DROP TABLE IF EXISTS line_references CASCADE;
    DROP TABLE IF EXISTS signatures CASCADE;
    DROP TABLE IF EXISTS document_responses CASCADE;
    DROP TABLE IF EXISTS document_references CASCADE;
    DROP TABLE IF EXISTS responses CASCADE;
    DROP TABLE IF EXISTS application_responses CASCADE;
    
    DROP TABLE IF EXISTS invoiceLines CASCADE;
    DROP TABLE IF EXISTS invoices CASCADE;
    DROP TABLE IF EXISTS monetaryTotals CASCADE;
    DROP TABLE IF EXISTS orderOrderLines CASCADE;
    DROP TABLE IF EXISTS orderLines CASCADE;
    DROP TABLE IF EXISTS orders CASCADE;
    DROP TABLE IF EXISTS lineItems CASCADE;
    DROP TABLE IF EXISTS items CASCADE;
    DROP TABLE IF EXISTS supplierParties CASCADE;
    DROP TABLE IF EXISTS customerParties CASCADE;
    DROP TABLE IF EXISTS parties CASCADE;
    DROP TABLE IF EXISTS languages CASCADE;
    DROP TABLE IF EXISTS statuses CASCADE;
  `;
  await pool.query(dropQuery);
}

let poolEnded = false;
export async function closeDb() {
  if (!poolEnded) {
    await pool.end();
    poolEnded = true;
  }
}