/**
 * TableAccessor defines the interface for accessing table data.
 * This mirrors the Go TableAccessor[T any] interface.
 */
export interface TableAccessor<T> {
    insert(tableId: string, data: T, options?: RequestOptions): Promise<void>;
    bulkInsert(tableId: string, data: T[], options?: RequestOptions): Promise<void>;
    find(tableId: string, query: Record<string, any>, options?: RequestOptions): Promise<T[]>;
    delete(tableId: string, query: Record<string, any>, options?: RequestOptions): Promise<void>;
    update(tableId: string, query: Record<string, any>, data: T, options?: RequestOptions): Promise<T[]>;
}
/**
 * RequestOptions allows per-request overrides (analogous to Go's context).
 */
export interface RequestOptions {
    /** AbortSignal for request cancellation (replaces Go's context.Context). */
    signal?: AbortSignal;
}
/**
 * Config holds configuration options for CnipsTableAccessor.
 * Mirrors the Go Config struct.
 */
export interface Config {
    /**
     * Timeout in milliseconds for HTTP requests.
     * If zero or undefined, defaults to 60000ms (60 seconds).
     */
    timeoutMs?: number;
    /**
     * Custom fetch function. Allows providing a custom HTTP client.
     * If undefined, the global fetch will be used.
     */
    fetchFn?: typeof fetch;
}
/**
 * CnipsTableAccessor is a concrete implementation of TableAccessor for cnips.
 * Mirrors the Go CnipsTableAccessor[T any] struct.
 */
export declare class CnipsTableAccessor<T> implements TableAccessor<T> {
    private fetchFn;
    private timeoutMs;
    baseURL: string;
    apiKey: string;
    /**
     * Creates a new CnipsTableAccessor instance.
     * @param baseURL - The base URL of the cnips instance (mandatory).
     * @param apiKey - The API key for the cnips instance (mandatory).
     * @param config - Optional configuration overrides.
     */
    constructor(baseURL: string, apiKey: string, config?: Config);
    /**
     * Builds the URL for standard row operations.
     * Mirrors Go's buildURL method.
     */
    private buildURL;
    /**
     * Builds the URL for the search endpoint.
     * Mirrors Go's buildSearchURL method.
     */
    private buildSearchURL;
    /**
     * Returns the common headers for all requests.
     * Mirrors Go's setHeaders method.
     */
    private getHeaders;
    /**
     * Performs an HTTP request and returns the response.
     * Mirrors Go's doRequest method.
     */
    private doRequest;
    /**
     * Reads the response body and checks the status code.
     * Mirrors Go's handleResponse method.
     */
    private handleResponse;
    /**
     * Inserts a new record into the specified table.
     * The data is wrapped in an array as the server expects an array.
     * Mirrors Go's Insert method.
     */
    insert(tableId: string, data: T, options?: RequestOptions): Promise<void>;
    /**
     * Inserts multiple records into the specified table.
     * Mirrors Go's BulkInsert method.
     */
    bulkInsert(tableId: string, data: T[], options?: RequestOptions): Promise<void>;
    /**
     * Retrieves records from the specified table matching the query.
     * Uses POST request to /search endpoint with query in the request body.
     * Mirrors Go's Find method.
     */
    find(tableId: string, query: Record<string, any>, options?: RequestOptions): Promise<T[]>;
    /**
     * Removes records from the specified table matching the query.
     * Uses DELETE request with query in the request body.
     * Mirrors Go's Delete method.
     */
    delete(tableId: string, query: Record<string, any>, options?: RequestOptions): Promise<void>;
    /**
     * Updates records in the specified table matching the query with the provided data.
     * Uses PUT request with query and data in the request body.
     * Mirrors Go's Update method.
     */
    update(tableId: string, query: Record<string, any>, data: T, options?: RequestOptions): Promise<T[]>;
}
