// Import necessary modules
import { Hono } from 'npm:hono'; 
import { describeRoute, openAPISpecs } from 'npm:hono-openapi';
import { resolver, validator as zValidator } from 'npm:hono-openapi/zod';
import { z } from 'npm:zod';

import { extendZodWithOpenApi } from 'npm:zod-openapi'
extendZodWithOpenApi(z)

// Define RouteDefinition type if not already defined
type RouteDefinition = any; // Replace with actual definition

// PhatsAPI class
export class PhatsAPI {
    private hono = new Hono();
    private routes: RouteDefinition[] = [];

    constructor() {
        this.fetch = this.fetch.bind(this);
        this.hono.get(
            "/openapi",
            openAPISpecs(this.hono, {
                documentation: {
                    info: {
                        title: "Hono",
                        version: "1.0.0",
                        description: "API for greeting users",
                    },
                    servers: [
                        {
                            // TODO determine this
                            url: "http://localhost:3000",
                            description: "Local server",
                        },
                    ],
                },
            })
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
            }
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
            }
        );
    }

    public fetch(...args: Parameters<typeof Hono.prototype.fetch>): ReturnType<typeof Hono.prototype.fetch> {
        return this.hono.fetch(...args);
    }
}
