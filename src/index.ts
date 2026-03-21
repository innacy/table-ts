/**
 * TableAccessor defines the interface for accessing table data.
 * This mirrors the Go TableAccessor[T any] interface.
 */
export interface TableAccessor<T> {
  insert(tableId: string, data: T, options?: RequestOptions): Promise<void>;
  bulkInsert(
    tableId: string,
    data: T[],
    options?: RequestOptions
  ): Promise<void>;
  find(
    tableId: string,
    query: Record<string, any>,
    options?: RequestOptions
  ): Promise<T[]>;
  delete(
    tableId: string,
    query: Record<string, any>,
    options?: RequestOptions
  ): Promise<void>;
  update(
    tableId: string,
    query: Record<string, any>,
    data: T,
    options?: RequestOptions
  ): Promise<T[]>;
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
export class CnipsTableAccessor<T> implements TableAccessor<T> {
  private fetchFn: typeof fetch;
  private timeoutMs: number;
  public baseURL: string;
  public apiKey: string;

  /**
   * Creates a new CnipsTableAccessor instance.
   * @param baseURL - The base URL of the cnips instance (mandatory).
   * @param apiKey - The API key for the cnips instance (mandatory).
   * @param config - Optional configuration overrides.
   */
  constructor(baseURL: string, apiKey: string, config?: Config) {
    this.baseURL = baseURL.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeoutMs = config?.timeoutMs || 60_000;
    this.fetchFn = config?.fetchFn || globalThis.fetch;
  }

  /**
   * Builds the URL for standard row operations.
   * Mirrors Go's buildURL method.
   */
  private buildURL(tableId: string): string {
    if (!tableId) {
      throw new Error("tableId cannot be empty");
    }

    try {
      const base = new URL(this.baseURL);
      base.pathname =
        base.pathname.replace(/\/+$/, "") +
        `/tables/${encodeURIComponent(tableId)}/rows`;
      return base.toString();
    } catch {
      throw new Error(`invalid base URL: ${this.baseURL}`);
    }
  }

  /**
   * Builds the URL for the search endpoint.
   * Mirrors Go's buildSearchURL method.
   */
  private buildSearchURL(tableId: string): string {
    if (!tableId) {
      throw new Error("tableId cannot be empty");
    }

    try {
      const base = new URL(this.baseURL);
      base.pathname =
        base.pathname.replace(/\/+$/, "") +
        `/tables/${encodeURIComponent(tableId)}/rows/search`;
      return base.toString();
    } catch {
      throw new Error(`invalid base URL: ${this.baseURL}`);
    }
  }

  /**
   * Returns the common headers for all requests.
   * Mirrors Go's setHeaders method.
   */
  private getHeaders(): Record<string, string> {
    return {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  /**
   * Performs an HTTP request and returns the response.
   * Mirrors Go's doRequest method.
   */
  private async doRequest(
    method: string,
    url: string,
    body?: any,
    options?: RequestOptions
  ): Promise<Response> {
    const controller = new AbortController();
    const externalSignal = options?.signal;

    // Link external signal to our controller
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
      } else {
        externalSignal.addEventListener("abort", () =>
          controller.abort(externalSignal.reason)
        );
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
    } catch (err: any) {
      throw new Error(`request failed: ${err?.message || err}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Reads the response body and checks the status code.
   * Mirrors Go's handleResponse method.
   */
  private async handleResponse(
    resp: Response,
    ...expectedStatusCodes: number[]
  ): Promise<void> {
    const bodyText = await resp.text();

    if (expectedStatusCodes.length === 0) {
      expectedStatusCodes = [200, 201];
    }

    if (!expectedStatusCodes.includes(resp.status)) {
      let bodyStr = bodyText;
      if (bodyStr.length > 500) {
        bodyStr = bodyStr.substring(0, 500) + "...";
      }
      throw new Error(
        `unexpected status code ${resp.status}: ${resp.statusText} (response: ${bodyStr})`
      );
    }
  }

  /**
   * Inserts a new record into the specified table.
   * The data is wrapped in an array as the server expects an array.
   * Mirrors Go's Insert method.
   */
  async insert(
    tableId: string,
    data: T,
    options?: RequestOptions
  ): Promise<void> {
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
  async bulkInsert(
    tableId: string,
    data: T[],
    options?: RequestOptions
  ): Promise<void> {
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
  async find(
    tableId: string,
    query: Record<string, any>,
    options?: RequestOptions
  ): Promise<T[]> {
    const requestURL = this.buildSearchURL(tableId);
    const requestBody = { filters: query };

    const resp = await this.doRequest("POST", requestURL, requestBody, options);

    if (resp.status !== 200) {
      let bodyStr = await resp.text();
      if (bodyStr.length > 500) {
        bodyStr = bodyStr.substring(0, 500) + "...";
      }
      throw new Error(
        `unexpected status code ${resp.status}: ${resp.statusText} (response: ${bodyStr})`
      );
    }

    const results: {
      success: boolean;
      data: {
        list: Array<{ data: any; [key: string]: any }>;
        count: number;
      };
    } = await resp.json();

    if (!results.success) {
      throw new Error("failed to get data");
    }

    const resultsT: T[] = new Array(results.data.count);
    for (let i = 0; i < results.data.list.length; i++) {
      resultsT[i] = results.data.list[i].data as T;
    }

    return resultsT;
  }

  /**
   * Removes records from the specified table matching the query.
   * Uses DELETE request with query in the request body.
   * Mirrors Go's Delete method.
   */
  async delete(
    tableId: string,
    query: Record<string, any>,
    options?: RequestOptions
  ): Promise<void> {
    const requestURL = this.buildURL(tableId);
    const requestBody = { filters: query };

    const resp = await this.doRequest(
      "DELETE",
      requestURL,
      requestBody,
      options
    );
    await this.handleResponse(resp, 200, 204);
  }

  /**
   * Updates records in the specified table matching the query with the provided data.
   * Uses PUT request with query and data in the request body.
   * Mirrors Go's Update method.
   */
  async update(
    tableId: string,
    query: Record<string, any>,
    data: T,
    options?: RequestOptions
  ): Promise<T[]> {
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
      throw new Error(
        `unexpected status code ${resp.status}: ${resp.statusText} (response: ${bodyStr})`
      );
    }

    const results: {
      success: boolean;
      data: Array<{ data: any; [key: string]: any }>;
    } = await resp.json();

    if (!results.success) {
      throw new Error("failed to update data");
    }

    const resultsT: T[] = new Array(results.data.length);
    for (let i = 0; i < results.data.length; i++) {
      resultsT[i] = results.data[i].data as T;
    }

    return resultsT;
  }
}
