import { Hono } from "npm:hono";
import { openAPISpecs, describeRoute } from 'npm:hono-openapi@0.3.1';
import { resolver, validator as zValidator } from 'npm:hono-openapi/zod';
import { OpenApiSpecsOptions } from './hono-openapi-types.ts';
  
import { z } from 'npm:zod';

import { extendZodWithOpenApi } from 'npm:zod-openapi';
extendZodWithOpenApi(z);

/**
 * PhatsAPI class for creating RESTful APIs using Hono framework with OpenAPI support.
 *
 * This class simplifies the process of defining routes, handling requests, and generating OpenAPI documentation.
 */
export class PhatsAPI {
    private hono: Hono;

    /**
     * Constructor for PhatsAPI.
     *
     * @param openapiOptions - Optional parameters to configure the OpenAPI documentation.
     * @example
     * const api = new PhatsAPI({
     *   documentation: {
     *     info: {
     *       title: 'My API',
     *       version: '1.0.0',
     *     },
     *   },
     * });
     */
    constructor(openapiOptions: OpenApiSpecsOptions) {
        this.hono = new Hono();
        this.fetch = this.fetch.bind(this);
        this.hono.get(
            "/openapi",
            openAPISpecs(this.hono, openapiOptions),
        );
    }

    /**
     * GET method to retrieve resources or fetch data.
     *
     * @param path - The route path.
     * @param requestSchema - Zod schema for validating the query parameters.
     * @param responseSchema - Zod schema for validating the response body.
     * @param description - Description of the route for documentation.
     * @param handler - Async function that handles the request and returns the response.
     * @param responseDescription - Description of the successful response.
     */
    public get<RequestSchema extends z.ZodTypeAny, ResponseSchema extends z.ZodTypeAny>(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (req: z.infer<RequestSchema>) => Promise<z.infer<ResponseSchema>>,
        responseDescription: string = "Successful response",
    ): void {
        this.hono.get(
            path,
            describeRoute({
                description: description,
                responses: {
                    200: {
                        description: responseDescription,
                        content: {
                            'application/json': { schema: resolver(responseSchema) },
                        },
                    },
                },
            }),
            zValidator('query', requestSchema),
            async (c) => {
                const query = c.req.valid('query');
                const response = await handler(query);
                return c.json(responseSchema.parse(response));
            },
        );
    }

    /**
     * POST method to handle creating resources or submitting data.
     *
     * @param path - The route path.
     * @param requestSchema - Zod schema for validating the request body.
     * @param responseSchema - Zod schema for validating the response body.
     * @param description - Description of the route for documentation.
     * @param handler - Async function that handles the request and returns the response.
     * @param responseDescription - Description of the successful response.
     */
    public post<RequestSchema extends z.ZodTypeAny, ResponseSchema extends z.ZodTypeAny>(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (req: z.infer<RequestSchema>) => Promise<z.infer<ResponseSchema>>,
        responseDescription: string = "Successful response",
    ): void {
        this.hono.post(
            path,
            describeRoute({
                description: description,
                responses: {
                    201: {
                        description: responseDescription,
                        content: {
                            'application/json': { schema: resolver(responseSchema) },
                        },
                    },
                },
            }),
            zValidator('json', requestSchema),
            async (c) => {
                const body = c.req.valid('json');
                const response = await handler(body);
                return c.json(responseSchema.parse(response), 200);
            },
        );
    }

    /**
     * PUT method to handle updating resources.
     *
     * @param path - The route path.
     * @param requestSchema - Zod schema for validating the request body.
     * @param responseSchema - Zod schema for validating the response body.
     * @param description - Description of the route for documentation.
     * @param handler - Async function that handles the request and returns the response.
     * @param responseDescription - Description of the successful response.
     */
    public put<RequestSchema extends z.ZodTypeAny, ResponseSchema extends z.ZodTypeAny>(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (req: z.infer<RequestSchema>) => Promise<z.infer<ResponseSchema>>,
        responseDescription: string = "Successful response",
    ): void {
        this.hono.put(
            path,
            describeRoute({
                description: description,
                responses: {
                    200: {
                        description: responseDescription,
                        content: {
                            'application/json': { schema: resolver(responseSchema) },
                        },
                    },
                },
            }),
            zValidator('json', requestSchema),
            async (c) => {
                const body = c.req.valid('json');
                const response = await handler(body);
                return c.json(responseSchema.parse(response));
            },
        );
    }

    /**
     * DELETE method to handle deleting resources.
     *
     * @param path - The route path.
     * @param requestSchema - Zod schema for validating the query parameters or request body (optional).
     * @param responseSchema - Zod schema for validating the response body.
     * @param description - Description of the route for documentation.
     * @param handler - Async function that handles the request and returns the response.
     * @param responseDescription - Description of the successful response.
     */
    public delete<RequestSchema extends z.ZodTypeAny, ResponseSchema extends z.ZodTypeAny>(
        path: string,
        requestSchema: RequestSchema,
        responseSchema: ResponseSchema,
        description: string,
        handler: (req: z.infer<RequestSchema>) => Promise<z.infer<ResponseSchema>>,
        responseDescription: string = "Successful response",
    ): void {    
        this.hono.delete(
            path,
            describeRoute({
                description: description,
                responses: {
                    200: {
                        description: responseDescription,
                        content: {
                            'application/json': { schema: resolver(responseSchema) },
                        },
                    },
                },
            }),
            zValidator('json', requestSchema),
            async (c) => {
                const validatedData = c.req.valid('json')
                const response = await handler(validatedData);
                return c.json(responseSchema.parse(response));
            },
        );
    }

    /**
     * Handles fetch requests for the Hono application.
     *
     * @param args - Arguments passed to the Hono fetch method.
     * @returns The response from the Hono application.
     */
    public fetch(...args: Parameters<typeof Hono.prototype.fetch>): ReturnType<typeof Hono.prototype.fetch> {
        return this.hono.fetch(...args);
    }
}