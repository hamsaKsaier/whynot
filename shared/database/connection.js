"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.query = query;
exports.transaction = transaction;
exports.close = close;
const pg_1 = require("pg");
const logger_1 = require("../logger/logger");
const logger = (0, logger_1.createLogger)('database');
let pool = null;
/**
 * Get database connection pool
 */
function getPool() {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL ||
            `postgresql://${process.env.POSTGRES_USER || 'thundercode'}:${process.env.POSTGRES_PASSWORD || 'thundercode'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'thundercode'}`;
        pool = new pg_1.Pool({
            connectionString,
            max: 20, // Maximum number of clients in the pool
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        pool.on('error', (err) => {
            logger.error('Unexpected database pool error', err);
        });
        pool.on('connect', () => {
            logger.debug('New database connection established');
        });
    }
    return pool;
}
/**
 * Execute a query with automatic connection management
 */
async function query(text, params) {
    const pool = getPool();
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('Database query executed', {
            query: text.substring(0, 100),
            duration: `${duration}ms`,
            rows: result.rowCount
        });
        return result.rows;
    }
    catch (error) {
        const err = error;
        logger.error('Database query error', error, {
            query: text.substring(0, 100)
        });
        throw error;
    }
}
/**
 * Execute a transaction
 */
async function transaction(callback) {
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * Close all database connections
 */
async function close() {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info('Database connection pool closed');
    }
}
//# sourceMappingURL=connection.js.map