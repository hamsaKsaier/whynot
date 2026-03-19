import { Pool, PoolClient } from 'pg';
/**
 * Get database connection pool
 */
export declare function getPool(): Pool;
/**
 * Execute a query with automatic connection management
 */
export declare function query<T = any>(text: string, params?: any[]): Promise<T[]>;
/**
 * Execute a transaction
 */
export declare function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
/**
 * Close all database connections
 */
export declare function close(): Promise<void>;
//# sourceMappingURL=connection.d.ts.map