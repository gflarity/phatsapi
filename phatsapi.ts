/**
 * Import necessary modules and types from external libraries.
 */
import { Hono, Context, MiddlewareHandler } from "npm:hono@4.6.16";
import {
    openAPISpecs,
    describeRoute,
    DescribeRouteOptions,
} from "npm:hono-openapi@0.3.1";
import { resolver, validator } from "npm:hono-openapi@0.3.1/zod";
import { OpenApiSpecsOptions } from "./hono-openapi-types.ts";

import { z } from "npm:zod@3.24.1";
import { extendZodWithOpenApi } from "npm:zod-openapi@4.2.2";

/**
 * Extends Zod with OpenAPI capabilities.
 */
extendZodWithOpenApi(z);

/**
 * Represents a compound request schema that can include query parameters, JSON body, and path parameters.
 */
export type CompoundRequest = {
    /**
     * Zod schema for query parameters.
     */
    query?: z.ZodTypeAny;
    /**
     * Zod schema for JSON body.
     */
    json?: z.ZodTypeAny;
    /**
     * Zod schema for path parameters.
     */
    param?: z.ZodTypeAny;
};

/**
 * Extracts and merges the inferred output types from param, query, and json schemas into a single type.
 *
 * @template T - A type that extends CompoundRequest.
 */
type MergeSchemas<T extends CompoundRequest> =
    (T["param"] extends z.ZodObject<any> ? z.infer<T["param"]> : {}) &
        (T["query"] extends z.ZodObject<any> ? z.infer<T["query"]> : {}) &
        (T["json"] extends z.ZodObject<any> ? z.infer<T["json"]> : {});

/**
 * Enumerates possible locations for assigning a single schema based on the HTTP method.
 */
type SchemaLocation = "query" | "json";

/**
 * Merges multiple Zod schemas from different parts of a request into a single Zod object.
 *
 * @template T - A type that extends CompoundRequest.
 *
 * @param {T} request - An object containing optional param, query, and json schemas.
 * @returns {z.ZodObject<MergeSchemas<T>>} - A merged Zod object schema.
 */
function mergeSchemas<T extends CompoundRequest>(
    request: T
): z.ZodObject<MergeSchemas<T>> {
    // Extract shapes from each schema if they are ZodObjects; otherwise, use empty objects
    const paramShape =
        request.param instanceof z.ZodObject ? request.param.shape : {};
    const queryShape =
        request.query instanceof z.ZodObject ? request.query.shape : {};
    const bodyShape =
        request.json instanceof z.ZodObject ? request.json.shape : {};

    // Merge all shapes into a single object
    const mergedShape = { ...paramShape, ...queryShape, ...bodyShape };

    // Create and return the merged ZodObject
    return z.object(mergedShape) as z.ZodObject<MergeSchemas<T>>;
}

/**
 * Defines the schema for validation errors returned to the client.
 */
const validationErrorSchema = z.object({
    errors: z.array(
        z.object({
            field: z.string(),
            message: z.string(),
        })
    ),
});

/**
 * Handles Zod validation errors by formatting and sending a 400 Bad Request response.
 *
 * @param {z.ZodError} err - The Zod validation error.
 * @param {Context} c - The Hono context object.
 * @returns {Response} - A JSON response containing the formatted errors.
 */
function handleZodError(err: z.ZodError, c: Context) {
    const formattedErrors = err.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
    }));

    // Return a 400 Bad Request with error details
    return c.json({ errors: formattedErrors }, 400);
}

/**
 * Abstracted request handler that performs validation and manages the response logic.
 *
 * @template RequestSchema - The schema for the incoming request.
 * @template ResponseSchema - The schema for the outgoing response.
 *
 * @param {Context} c - The Hono context object.
 * @param {RequestSchema} requestSchema - The schema(s) for validating the request.
 * @param {ResponseSchema} responseSchema - The schema for validating the response.
 * @param {(
 *     req: MergeSchemas<RequestSchema>
 * ) => Promise<z.infer<ResponseSchema>>} handler - The handler function that processes the request.
 * @returns {Promise<Response>} - A promise that resolves to the JSON response.
 */
async function handleRequest<
    RequestSchema extends CompoundRequest,
    ResponseSchema extends z.ZodTypeAny
>(
    c: Context,
    requestSchema: RequestSchema,
    responseSchema: ResponseSchema,
    handler: (
        req: MergeSchemas<RequestSchema>
    ) => Promise<z.infer<ResponseSchema>>
) {
    const params = c.req.param();
    const query = c.req.query();
    const json = await c.req.json().catch(() => ({})); // Handle potential JSON parse errors

    // Create the merged Zod schema
    const mergedSchema = mergeSchemas(requestSchema);

    let request: MergeSchemas<RequestSchema>;
    try {
        request = await mergedSchema.parseAsync({
            ...params,
            ...query,
            ...json,
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return handleZodError(err, c);
        }

        // Handle other types of errors (optional)
        return c.json({ error: "Internal Server Error" }, 500);
    }

    const response = await handler(request);
    return c.json(responseSchema.parse(response), 200);
}

/**
 * Creates a standardized `describeRoute` configuration for HTTP methods.
 *
 * @template ResponseSchema - The Zod schema for the response.
 *
 * @param {string} description - A description of the route for documentation purposes.
 * @param {ResponseSchema} responseSchema - The Zod schema for validating the response.
 * @param {string} [responseDescription="Successful response"] - A description of the successful response.
 * @returns {DescribeRouteOptions} - The configuration object for describing the route.
 */
function createRouteConfig<ResponseSchema extends z.ZodTypeAny>(
    description: string,
    responseSchema: ResponseSchema,
    responseDescription: string = "Successful response"
): DescribeRouteOptions {
    return {
        description: description,
        responses: {
            200: {
                description: responseDescription,
                content: {
                    "application/json": { schema: resolver(responseSchema) },
                },
            },
            400: {
                description: "Bad request",
                content: {
                    "application/json": {
                        schema: resolver(validationErrorSchema),
                    },
                },
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: resolver(z.object({ error: z.string() })),
                    },
                },
            },
        },
    };
}

/**
 * PhatsAPI class for creating RESTful APIs using the Hono framework with OpenAPI support.
 */
export class PhatsAPI {
    /**
     * Internal instance of the Hono application.
     */
    private hono: Hono;

    /**
     * Constructs a new PhatsAPI instance.
     *
     * @param {OpenApiSpecsOptions} openapiOptions - Optional parameters to configure the OpenAPI documentation.
     *
     * @example
     * const api = new PhatsAPI({
     *   documentation: {
     *     info: {
     *       title: 'My API',
     *       version: '1.0.0',
     *     },
     *   },
     * })
     */
    constructor(openapiOptions: OpenApiSpecsOptions) {
        this.hono = new Hono();
        this.fetch = this.fetch.bind(this);
        this.hono.get("/openapi", openAPISpecs(this.hono, openapiOptions));
    }

    /**
     * Adds an HTTP method handler (GET, POST, PUT, DELETE) to the API with validation and documentation.
     *
     * @template Method - The HTTP method type.
     * @template RequestSchema - The schema(s) for validating the incoming request.
     * @template ResponseSchema - The schema for validating the outgoing response.
     *
     * @param {Method} method - The HTTP method (get, post, put, delete).
     * @param {string} path - The route path.
     * @param {RequestSchema} requestSchema - Zod schema(s) for validating the request.
     * @param {ResponseSchema} responseSchema - Zod schema for validating the response.
     * @param {string} description - Description of the route for documentation.
     * @param {(
     *     req: MergeSchemas<Extract<RequestSchema, CompoundRequest>>
     * ) => Promise<z.infer<ResponseSchema>>} handler - Async function that handles the request and returns the response.
     * @param {SchemaLocation} defaultSchemaLocation - Default location for single schema (query for GET, json for others).
     * @param {string} [responseDescription="Successful response"] - Description of the successful response.
     */
    private addMethod<
        Method extends "get" | "post" | "put" | "delete",
        RequestSchema extends CompoundRequest | z.ZodTypeAny,
        ResponseSchema extends z.ZodTypeAny
    >(
        method: Method,
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler:
            | ((
                  req: MergeSchemas<Extract<RequestSchema, CompoundRequest>>
              ) => Promise<z.infer<ResponseSchema>>)
            | ((
                  req: z.infer<Extract<RequestSchema, z.ZodTypeAny>>
              ) => Promise<z.infer<ResponseSchema>>),
        defaultSchemaLocation: SchemaLocation,
        responseDescription: string = "Successful response"
    ): void {
        const routeConfig = createRouteConfig(
            description,
            responseSchema,
            responseDescription
        );

        let compoundRequest: CompoundRequest;
        if (requestSchema instanceof z.ZodType) {
            // Single schema provided
            compoundRequest = {
                [defaultSchemaLocation]: requestSchema,
            } as CompoundRequest;
        } else {
            // CompoundRequest provided
            compoundRequest = requestSchema;
        }

        const paramSchema = compoundRequest.param ?? z.object({});
        const querySchema = compoundRequest.query ?? z.object({});
        const jsonSchema = compoundRequest.json ?? z.object({});

        this.hono[method](
            path,
            describeRoute(routeConfig),
            validator("param", paramSchema),
            validator("query", querySchema),
            validator("json", jsonSchema),
            async (c: Context) =>
                handleRequest(
                    c,
                    compoundRequest,
                    responseSchema,
                    handler as (
                        req:
                            | MergeSchemas<
                                  Extract<RequestSchema, CompoundRequest>
                              >
                            | z.infer<Extract<RequestSchema, z.ZodTypeAny>>
                    ) => Promise<z.infer<ResponseSchema>>
                )
        );
    }

    /**
     * Registers a GET route with the API.
     *
     * This method is overloaded to support both compound request schemas and single Zod schemas.
     *
     * @template RequestSchema - The Zod schema for validating the request. Can be a `CompoundRequest` or a single `ZodTypeAny` schema.
     * @template ResponseSchema - The Zod schema for validating the response.
     *
     * @param {string} path - The route path.
     * @param {RequestSchema} requestSchema - Zod schema for validating the query parameters, path parameters, and/or request body.
     * @param {ResponseSchema} responseSchema - Zod schema for validating the response body.
     * @param {string} description - Description of the route for documentation.
     * @param {(
     *     req: MergeSchemas<RequestSchema>
     * ) => Promise<z.infer<ResponseSchema>>} handler - Async function that handles the request and returns the response.
     * @param {string} [responseDescription="Successful response"] - Description of the successful response.
     */
    public get<
        RequestSchema extends CompoundRequest,
        ResponseSchema extends z.ZodTypeAny
    >(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (
            req: MergeSchemas<RequestSchema>
        ) => Promise<z.infer<ResponseSchema>>,
        responseDescription?: string
    ): void;

    /**
     * Registers a GET route with the API using a single Zod schema for the request.
     *
     * @template RequestSchema - The Zod schema for validating the request.
     * @template ResponseSchema - The Zod schema for validating the response.
     *
     * @param {string} path - The route path.
     * @param {RequestSchema} requestSchema - Zod schema for validating the request.
     * @param {ResponseSchema} responseSchema - Zod schema for validating the response.
     * @param {string} description - Description of the route for documentation.
     * @param {(
     *     req: z.infer<RequestSchema>
     * ) => Promise<z.infer<ResponseSchema>>} handler - Async function that handles the request and returns the response.
     * @param {string} [responseDescription="Successful response"] - Description of the successful response.
     */
    public get<
        RequestSchema extends z.ZodTypeAny,
        ResponseSchema extends z.ZodTypeAny
    >(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (
            req: z.infer<RequestSchema>
        ) => Promise<z.infer<ResponseSchema>>,
        responseDescription?: string
    ): void;

    /**
     * Implementation of the overloaded GET method.
     *
     * @param {string} path - The route path.
     * @param {CompoundRequest | z.ZodTypeAny} requestSchema - The request schema(s).
     * @param {z.ZodTypeAny} responseSchema - The response schema.
     * @param {string} description - The route description.
     * @param {(
     *     req: MergeSchemas<Extract<RequestSchema, CompoundRequest>> | z.infer<Extract<RequestSchema, z.ZodTypeAny>>
     * ) => Promise<z.infer<ResponseSchema>>} handler - The request handler.
     * @param {string} [responseDescription="Successful response"] - The response description.
     */
    public get<
        RequestSchema extends CompoundRequest | z.ZodTypeAny,
        ResponseSchema extends z.ZodTypeAny
    >(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (
            req:
                | MergeSchemas<Extract<RequestSchema, CompoundRequest>>
                | z.infer<Extract<RequestSchema, z.ZodTypeAny>>
        ) => Promise<z.infer<ResponseSchema>>,
        responseDescription: string = "Successful response"
    ): void {
        this.addMethod(
            "get",
            path,
            requestSchema,
            responseSchema,
            description,
            handler,
            "query",
            responseDescription
        );
    }

    /**
     * Registers a POST route with the API.
     *
     * This method is overloaded to support both compound request schemas and single Zod schemas.
     *
     * @template RequestSchema - The Zod schema for validating the request. Can be a `CompoundRequest` or a single `ZodTypeAny` schema.
     * @template ResponseSchema - The Zod schema for validating the response.
     *
     * @param {string} path - The route path.
     * @param {RequestSchema} requestSchema - Zod schema for validating the query parameters, path parameters, and/or request body.
     * @param {ResponseSchema} responseSchema - Zod schema for validating the response body.
     * @param {string} description - Description of the route for documentation.
     * @param {(
     *     req: MergeSchemas<RequestSchema>
     * ) => Promise<z.infer<ResponseSchema>>} handler - Async function that handles the request and returns the response.
     * @param {string} [responseDescription="Successful response"] - Description of the successful response.
     */
    public post<
        RequestSchema extends CompoundRequest,
        ResponseSchema extends z.ZodTypeAny
    >(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (
            req: MergeSchemas<RequestSchema>
        ) => Promise<z.infer<ResponseSchema>>,
        responseDescription?: string
    ): void;

    /**
     * Registers a POST route with the API using a single Zod schema for the request.
     *
     * @template RequestSchema - The Zod schema for validating the request.
     * @template ResponseSchema - The Zod schema for validating the response.
     *
     * @param {string} path - The route path.
     * @param {RequestSchema} requestSchema - Zod schema for validating the request.
     * @param {ResponseSchema} responseSchema - Zod schema for validating the response.
     * @param {string} description - Description of the route for documentation.
     * @param {(
     *     req: z.infer<RequestSchema>
     * ) => Promise<z.infer<ResponseSchema>>} handler - Async function that handles the request and returns the response.
     * @param {string} [responseDescription="Successful response"] - Description of the successful response.
     */
    public post<
        RequestSchema extends z.ZodTypeAny,
        ResponseSchema extends z.ZodTypeAny
    >(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (
            req: z.infer<RequestSchema>
        ) => Promise<z.infer<ResponseSchema>>,
        responseDescription?: string
    ): void;

    /**
     * Implementation of the overloaded POST method.
     *
     * @param {string} path - The route path.
     * @param {CompoundRequest | z.ZodTypeAny} requestSchema - The request schema(s).
     * @param {z.ZodTypeAny} responseSchema - The response schema.
     * @param {string} description - The route description.
     * @param {(
     *     req: MergeSchemas<Extract<RequestSchema, CompoundRequest>> | z.infer<Extract<RequestSchema, z.ZodTypeAny>>
     * ) => Promise<z.infer<ResponseSchema>>} handler - The request handler.
     * @param {string} [responseDescription="Successful response"] - The response description.
     */
    public post<
        RequestSchema extends CompoundRequest | z.ZodTypeAny,
        ResponseSchema extends z.ZodTypeAny
    >(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (
            req:
                | MergeSchemas<Extract<RequestSchema, CompoundRequest>>
                | z.infer<Extract<RequestSchema, z.ZodTypeAny>>
        ) => Promise<z.infer<ResponseSchema>>,
        responseDescription: string = "Successful response"
    ): void {
        this.addMethod(
            "post",
            path,
            requestSchema,
            responseSchema,
            description,
            handler,
            "json",
            responseDescription
        );
    }

    /**
     * Registers a PUT route with the API.
     *
     * This method is overloaded to support both compound request schemas and single Zod schemas.
     *
     * @template RequestSchema - The Zod schema for validating the request. Can be a `CompoundRequest` or a single `ZodTypeAny` schema.
     * @template ResponseSchema - The Zod schema for validating the response.
     *
     * @param {string} path - The route path.
     * @param {RequestSchema} requestSchema - Zod schema for validating the query parameters, path parameters, and/or request body.
     * @param {ResponseSchema} responseSchema - Zod schema for validating the response body.
     * @param {string} description - Description of the route for documentation.
     * @param {(
     *     req: MergeSchemas<RequestSchema>
     * ) => Promise<z.infer<ResponseSchema>>} handler - Async function that handles the request and returns the response.
     * @param {string} [responseDescription="Successful response"] - Description of the successful response.
     */
    public put<
        RequestSchema extends CompoundRequest,
        ResponseSchema extends z.ZodTypeAny
    >(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (
            req: MergeSchemas<RequestSchema>
        ) => Promise<z.infer<ResponseSchema>>,
        responseDescription?: string
    ): void;

    /**
     * Registers a PUT route with the API using a single Zod schema for the request.
     *
     * @template RequestSchema - The Zod schema for validating the request.
     * @template ResponseSchema - The Zod schema for validating the response.
     *
     * @param {string} path - The route path.
     * @param {RequestSchema} requestSchema - Zod schema for validating the request.
     * @param {ResponseSchema} responseSchema - Zod schema for validating the response.
     * @param {string} description - Description of the route for documentation.
     * @param {(
     *     req: z.infer<RequestSchema>
     * ) => Promise<z.infer<ResponseSchema>>} handler - Async function that handles the request and returns the response.
     * @param {string} [responseDescription="Successful response"] - Description of the successful response.
     */
    public put<
        RequestSchema extends z.ZodTypeAny,
        ResponseSchema extends z.ZodTypeAny
    >(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (
            req: z.infer<RequestSchema>
        ) => Promise<z.infer<ResponseSchema>>,
        responseDescription?: string
    ): void;

    /**
     * Implementation of the overloaded PUT method.
     *
     * @param {string} path - The route path.
     * @param {CompoundRequest | z.ZodTypeAny} requestSchema - The request schema(s).
     * @param {z.ZodTypeAny} responseSchema - The response schema.
     * @param {string} description - The route description.
     * @param {(
     *     req: MergeSchemas<Extract<RequestSchema, CompoundRequest>> | z.infer<Extract<RequestSchema, z.ZodTypeAny>>
     * ) => Promise<z.infer<ResponseSchema>>} handler - The request handler.
     * @param {string} [responseDescription="Successful response"] - The response description.
     */
    public put<
        RequestSchema extends CompoundRequest | z.ZodTypeAny,
        ResponseSchema extends z.ZodTypeAny
    >(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (
            req:
                | MergeSchemas<Extract<RequestSchema, CompoundRequest>>
                | z.infer<Extract<RequestSchema, z.ZodTypeAny>>
        ) => Promise<z.infer<ResponseSchema>>,
        responseDescription: string = "Successful response"
    ): void {
        this.addMethod(
            "put",
            path,
            requestSchema,
            responseSchema,
            description,
            handler,
            "json",
            responseDescription
        );
    }

    /**
     * Registers a DELETE route with the API.
     *
     * This method is overloaded to support both compound request schemas and single Zod schemas.
     *
     * @template RequestSchema - The Zod schema for validating the request. Can be a `CompoundRequest` or a single `ZodTypeAny` schema.
     * @template ResponseSchema - The Zod schema for validating the response.
     *
     * @param {string} path - The route path.
     * @param {RequestSchema} requestSchema - Zod schema for validating the query parameters, path parameters, and/or request body.
     * @param {ResponseSchema} responseSchema - Zod schema for validating the response body.
     * @param {string} description - Description of the route for documentation.
     * @param {(
     *     req: MergeSchemas<RequestSchema>
     * ) => Promise<z.infer<ResponseSchema>>} handler - Async function that handles the request and returns the response.
     * @param {string} [responseDescription="Successful response"] - Description of the successful response.
     */
    public delete<
        RequestSchema extends CompoundRequest,
        ResponseSchema extends z.ZodTypeAny
    >(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (
            req: MergeSchemas<RequestSchema>
        ) => Promise<z.infer<ResponseSchema>>,
        responseDescription?: string
    ): void;

    /**
     * Registers a DELETE route with the API using a single Zod schema for the request.
     *
     * @template RequestSchema - The Zod schema for validating the request.
     * @template ResponseSchema - The Zod schema for validating the response.
     *
     * @param {string} path - The route path.
     * @param {RequestSchema} requestSchema - Zod schema for validating the request.
     * @param {ResponseSchema} responseSchema - Zod schema for validating the response.
     * @param {string} description - Description of the route for documentation.
     * @param {(
     *     req: z.infer<RequestSchema>
     * ) => Promise<z.infer<ResponseSchema>>} handler - Async function that handles the request and returns the response.
     * @param {string} [responseDescription="Successful response"] - Description of the successful response.
     */
    public delete<
        RequestSchema extends z.ZodTypeAny,
        ResponseSchema extends z.ZodTypeAny
    >(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (
            req: z.infer<RequestSchema>
        ) => Promise<z.infer<ResponseSchema>>,
        responseDescription?: string
    ): void;

    /**
     * Implementation of the overloaded DELETE method.
     *
     * @param {string} path - The route path.
     * @param {CompoundRequest | z.ZodTypeAny} requestSchema - The request schema(s).
     * @param {z.ZodTypeAny} responseSchema - The response schema.
     * @param {string} description - The route description.
     * @param {(
     *     req: MergeSchemas<Extract<RequestSchema, CompoundRequest>> | z.infer<Extract<RequestSchema, z.ZodTypeAny>>
     * ) => Promise<z.infer<ResponseSchema>>} handler - The request handler.
     * @param {string} [responseDescription="Successful response"] - The response description.
     */
    public delete<
        RequestSchema extends CompoundRequest | z.ZodTypeAny,
        ResponseSchema extends z.ZodTypeAny
    >(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (
            req:
                | MergeSchemas<Extract<RequestSchema, CompoundRequest>>
                | z.infer<Extract<RequestSchema, z.ZodTypeAny>>
        ) => Promise<z.infer<ResponseSchema>>,
        responseDescription: string = "Successful response"
    ): void {
        this.addMethod(
            "delete",
            path,
            requestSchema,
            responseSchema,
            description,
            handler,
            "json",
            responseDescription
        );
    }

    /**
     * Handles incoming fetch requests by delegating them to the internal Hono application.
     *
     * @param {...any[]} args - Arguments passed to the Hono fetch method.
     * @returns {Promise<Response>} - The response from the Hono application.
     */
    public fetch(
        ...args: Parameters<typeof Hono.prototype.fetch>
    ): ReturnType<typeof Hono.prototype.fetch> {
        return this.hono.fetch(...args);
    }

    /**
     * Adds middleware to the Hono application.
     *
     * This method is overloaded to support different middleware configurations, including specifying a path.
     *
     * @param {MiddlewareHandler} middleware - A single middleware handler.
     * @example
     * api.use(async (c, next) => {
     *   // Middleware logic
     *   await next();
     * });
     *
     * @example
     * api.use('/api', async (c, next) => {
     *   // Middleware logic for '/api' routes
     *   await next();
     * });
     */
    public use(middleware: MiddlewareHandler): void;
    public use(path: string, middleware: MiddlewareHandler): void;
    public use(...middleware: MiddlewareHandler[]): void; // Multiple middleware
    public use(path: string, ...middleware: MiddlewareHandler[]): void; // Path + multiple middleware
    // Add more overloads as needed for specific cases

    /**
     * Implementation of the overloaded use method.
     *
     * @param {...any[]} args - Arguments passed to the Hono use method.
     */
    public use(...args: any[]): void {
        this.hono.use(...args);
    }
}
