import { Hono, Context } from "npm:hono@4.6.16"
import { openAPISpecs, describeRoute, DescribeRouteOptions } from 'npm:hono-openapi@0.3.1'
import { resolver } from 'npm:hono-openapi@0.3.1/zod'
import { OpenApiSpecsOptions } from './hono-openapi-types.ts'

import { z } from 'npm:zod@3.24.1'
import { extendZodWithOpenApi } from 'npm:zod-openapi@4.2.2'
extendZodWithOpenApi(z)

// Define the schema for validation errors
const validationErrorSchema = z.object({
  errors: z.array(
    z.object({
      field: z.string(),
      message: z.string(),
    })
  ),
})

// Return zod validation error matching validationErrorSchema
function handleZodEror(err: z.ZodError, c: Context) {
  const formattedErrors = err.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }))

  // Return a 400 Bad Request with error details
  return c.json({ errors: formattedErrors }, 400)
}

/**
 * Abstracted request handler for common validation and response logic.
 */
async function handleRequest<
  RequestSchema extends z.ZodTypeAny,
  ResponseSchema extends z.ZodTypeAny,
>(
  c: Context,
  requestSchema: RequestSchema,
  responseSchema: ResponseSchema,
  handler: (req: z.infer<RequestSchema>) => Promise<z.infer<ResponseSchema>>,
) {
  const params = c.req.param()
  const query = c.req.query()
  const body = await c.req.json().catch(() => ({})) // Handle potential JSON parse errors
  let request
  try {
    request = await requestSchema.parseAsync({ ...params, ...query, ...body })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return handleZodEror(err, c)
    }

    // Handle other types of errors (optional)
    return c.json({ error: 'Internal Server Error' }, 500)
  }

  const response = await handler(request)
  return c.json(responseSchema.parse(response), 200)
}

/**
 * Creates a common `describeRoute` configuration for POST, PUT, and DELETE methods.
 */
function createRouteConfig<ResponseSchema extends z.ZodTypeAny>(
  description: string,
  responseSchema: ResponseSchema,
  responseDescription: string = "Successful response",
): DescribeRouteOptions {
  return {
    description: description,
    responses: {
      200: {
        description: responseDescription,
        content: {
          'application/json': { schema: resolver(responseSchema) },
        },
      },
      400: {
        description: "Bad request",
        content: {
          'application/json': { schema: resolver(validationErrorSchema) },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          'application/json': { schema: resolver(z.object({ error: z.string() })) },
        },
      },
    },
  }
}

/**
 * PhatsAPI class for creating RESTful APIs using Hono framework with OpenAPI support.
 */
export class PhatsAPI {
  private hono: Hono

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
   * })
   */
  constructor(openapiOptions: OpenApiSpecsOptions) {
    this.hono = new Hono()
    this.fetch = this.fetch.bind(this)
    this.hono.get("/openapi", openAPISpecs(this.hono, openapiOptions))
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
  public get<
    RequestSchema extends z.ZodTypeAny,
    ResponseSchema extends z.ZodTypeAny,
  >(
    path: string,
    requestSchema: RequestSchema,
    responseSchema: ResponseSchema,
    description: string,
    handler: (req: z.infer<RequestSchema>) => Promise<z.infer<ResponseSchema>>,
    responseDescription: string = "Successful response",
  ): void {
    const routeConfig = createRouteConfig(
        description,
        responseSchema,
        responseDescription,
    )
    this.hono.get(
        path,
        describeRoute(routeConfig),
        async (c) => handleRequest(c, requestSchema, responseSchema, handler),
    )
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
  public post<
    RequestSchema extends z.ZodTypeAny,
    ResponseSchema extends z.ZodTypeAny,
  >(
    path: string,
    requestSchema: RequestSchema,
    responseSchema: ResponseSchema,
    description: string,
    handler: (req: z.infer<RequestSchema>) => Promise<z.infer<ResponseSchema>>,
    responseDescription: string = "Successful response",
  ): void {
    const routeConfig = createRouteConfig(
      description,
      responseSchema,
      responseDescription,
    )
    this.hono.post(
      path,
      describeRoute(routeConfig),
      async (c) => handleRequest(c, requestSchema, responseSchema, handler),
    )
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
  public put<
    RequestSchema extends z.ZodTypeAny,
    ResponseSchema extends z.ZodTypeAny,
  >(
    path: string,
    requestSchema: RequestSchema,
    responseSchema: ResponseSchema,
    description: string,
    handler: (req: z.infer<RequestSchema>) => Promise<z.infer<ResponseSchema>>,
    responseDescription: string = "Successful response",
  ): void {
    const routeConfig = createRouteConfig(
      description,
      responseSchema,
      responseDescription,
    )
    this.hono.put(
      path,
      describeRoute(routeConfig),
      async (c) => handleRequest(c, requestSchema, responseSchema, handler),
    )
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
  public delete<
    RequestSchema extends z.ZodTypeAny,
    ResponseSchema extends z.ZodTypeAny,
  >(
    path: string,
    requestSchema: RequestSchema,
    responseSchema: ResponseSchema,
    description: string,
    handler: (req: z.infer<RequestSchema>) => Promise<z.infer<ResponseSchema>>,
    responseDescription: string = "Successful response",
  ): void {
    const routeConfig = createRouteConfig(
      description,
      responseSchema,
      responseDescription,
    )
    this.hono.delete(
      path,
      describeRoute(routeConfig),
      async (c) => handleRequest(c, requestSchema, responseSchema, handler),
    )
  }

  /**
   * Handles fetch requests for the Hono application.
   *
   * @param args - Arguments passed to the Hono fetch method.
   * @returns The response from the Hono application.
   */
  public fetch(
    ...args: Parameters<typeof Hono.prototype.fetch>
  ): ReturnType<typeof Hono.prototype.fetch> {
    return this.hono.fetch(...args)
  }
}