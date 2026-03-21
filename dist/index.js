"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CnipsTableAccessor = void 0;
/**
 * CnipsTableAccessor is a concrete implementation of TableAccessor for cnips.
 * Mirrors the Go CnipsTableAccessor[T any] struct.
 */
class CnipsTableAccessor {
    /**
     * Creates a new CnipsTableAccessor instance.
     * @param baseURL - The base URL of the cnips instance (mandatory).
     * @param apiKey - The API key for the cnips instance (mandatory).
     * @param config - Optional configuration overrides.
     */
    constructor(baseURL, apiKey, config) {
        this.baseURL = baseURL.replace(/\/+$/, "");
        this.apiKey = apiKey;
        this.timeoutMs = config?.timeoutMs || 60000;
        this.fetchFn = config?.fetchFn || globalThis.fetch;
    }
    /**
     * Builds the URL for standard row operations.
     * Mirrors Go's buildURL method.
     */
    buildURL(tableId) {
        if (!tableId) {
            throw new Error("tableId cannot be empty");
        }
        try {
            const base = new URL(this.baseURL);
            base.pathname =
                base.pathname.replace(/\/+$/, "") +
                    `/tables/${encodeURIComponent(tableId)}/rows`;
            return base.toString();
        }
        catch {
            throw new Error(`invalid base URL: ${this.baseURL}`);
        }
    }
    /**
     * Builds the URL for the search endpoint.
     * Mirrors Go's buildSearchURL method.
     */
    buildSearchURL(tableId) {
        if (!tableId) {
            throw new Error("tableId cannot be empty");
        }
        try {
            const base = new URL(this.baseURL);
            base.pathname =
                base.pathname.replace(/\/+$/, "") +
                    `/tables/${encodeURIComponent(tableId)}/rows/search`;
            return base.toString();
        }
        catch {
            throw new Error(`invalid base URL: ${this.baseURL}`);
        }
    }
    /**
     * Returns the common headers for all requests.
     * Mirrors Go's setHeaders method.
     */
    getHeaders() {
        return {
            "X-API-Key": this.apiKey,
            "Content-Type": "application/json",
        };
    }
    /**
     * Performs an HTTP request and returns the response.
     * Mirrors Go's doRequest method.
     */
    async doRequest(method, url, body, options) {
        const controller = new AbortController();
        const externalSignal = options?.signal;
        // Link external signal to our controller
        if (externalSignal) {
            if (externalSignal.aborted) {
                controller.abort(externalSignal.reason);
            }
            else {
                externalSignal.addEventListener("abort", () => controller.abort(externalSignal.reason));
            }
        }
        // Set up timeout
        const timeoutId = setTimeout(() => controller.abort("request timeout"), this.timeoutMs);
        try {
            const response = await this.fetchFn(url, {
                method,
                headers: this.getHeaders(),
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            return response;
        }
        catch (err) {
            throw new Error(`request failed: ${err?.message || err}`);
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    /**
     * Reads the response body and checks the status code.
     * Mirrors Go's handleResponse method.
     */
    async handleResponse(resp, ...expectedStatusCodes) {
        const bodyText = await resp.text();
        if (expectedStatusCodes.length === 0) {
            expectedStatusCodes = [200, 201];
        }
        if (!expectedStatusCodes.includes(resp.status)) {
            let bodyStr = bodyText;
            if (bodyStr.length > 500) {
                bodyStr = bodyStr.substring(0, 500) + "...";
            }
            throw new Error(`unexpected status code ${resp.status}: ${resp.statusText} (response: ${bodyStr})`);
        }
    }
    /**
     * Inserts a new record into the specified table.
     * The data is wrapped in an array as the server expects an array.
     * Mirrors Go's Insert method.
     */
    async insert(tableId, data, options) {
        if (data === null || data === undefined) {
            throw new Error("data cannot be nil");
        }
        const requestURL = this.buildURL(tableId);
        const resp = await this.doRequest("POST", requestURL, [data], options);
        await this.handleResponse(resp, 201, 200);
    }
    /**
     * Inserts multiple records into the specified table.
     * Mirrors Go's BulkInsert method.
     */
    async bulkInsert(tableId, data, options) {
        if (!data || data.length === 0) {
            throw new Error("data cannot be empty");
        }
        const requestURL = this.buildURL(tableId);
        const resp = await this.doRequest("POST", requestURL, data, options);
        await this.handleResponse(resp, 201, 200);
    }
    /**
     * Retrieves records from the specified table matching the query.
     * Uses POST request to /search endpoint with query in the request body.
     * Mirrors Go's Find method.
     */
    async find(tableId, query, options) {
        const requestURL = this.buildSearchURL(tableId);
        const requestBody = { filters: query };
        const resp = await this.doRequest("POST", requestURL, requestBody, options);
        if (resp.status !== 200) {
            let bodyStr = await resp.text();
            if (bodyStr.length > 500) {
                bodyStr = bodyStr.substring(0, 500) + "...";
            }
            throw new Error(`unexpected status code ${resp.status}: ${resp.statusText} (response: ${bodyStr})`);
        }
        const results = await resp.json();
        if (!results.success) {
            throw new Error("failed to get data");
        }
        const resultsT = new Array(results.data.count);
        for (let i = 0; i < results.data.list.length; i++) {
            resultsT[i] = results.data.list[i].data;
        }
        return resultsT;
    }
    /**
     * Removes records from the specified table matching the query.
     * Uses DELETE request with query in the request body.
     * Mirrors Go's Delete method.
     */
    async delete(tableId, query, options) {
        const requestURL = this.buildURL(tableId);
        const requestBody = { filters: query };
        const resp = await this.doRequest("DELETE", requestURL, requestBody, options);
        await this.handleResponse(resp, 200, 204);
    }
    /**
     * Updates records in the specified table matching the query with the provided data.
     * Uses PUT request with query and data in the request body.
     * Mirrors Go's Update method.
     */
    async update(tableId, query, data, options) {
        if (data === null || data === undefined) {
            throw new Error("data cannot be nil");
        }
        const requestURL = this.buildURL(tableId);
        const requestBody = { filters: query, data };
        const resp = await this.doRequest("PUT", requestURL, requestBody, options);
        if (resp.status !== 200) {
            let bodyStr = await resp.text();
            if (bodyStr.length > 500) {
                bodyStr = bodyStr.substring(0, 500) + "...";
            }
            throw new Error(`unexpected status code ${resp.status}: ${resp.statusText} (response: ${bodyStr})`);
        }
        const results = await resp.json();
        if (!results.success) {
            throw new Error("failed to update data");
        }
        const resultsT = new Array(results.data.length);
        for (let i = 0; i < results.data.length; i++) {
            resultsT[i] = results.data[i].data;
        }
        return resultsT;
    }
}
exports.CnipsTableAccessor = CnipsTableAccessor;
