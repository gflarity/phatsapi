import type { OpenAPIV3 } from "npm:openapi-types";

/**
 * Allowed HTTP methods for OpenAPI.
 */
export const ALLOWED_METHODS = [
    "GET",
    "PUT",
    "POST",
    "DELETE",
    // Not yet supported:
    //    "OPTIONS",
    //    "HEAD",
    //    "PATCH",
    //    "TRACE",
] as const;

// OpenAPI Specs Options, this was copied from hono-openapi/src/types.ts but it can't be imported due to 
// https://github.com/rhinobase/hono-openapi/issues/13
/**
 * Options for configuring OpenAPI specifications.
 */
export type OpenApiSpecsOptions = {
    /**
     * Customize OpenAPI config, refers to Swagger 2.0 config
     *
     * @see https://swagger.io/specification/v2/
     */
    documentation?: Omit<
      Partial<OpenAPIV3.Document>,
      | "x-express-openapi-additional-middleware"
      | "x-express-openapi-validation-strict"
    >;
  
    /**
     * Determine if Swagger should exclude static files.
     *
     * @default true
     */
    excludeStaticFile?: boolean;
  
    /**
     * Paths to exclude from OpenAPI endpoint
     *
     * @default []
     */
    exclude?: string | RegExp | Array<string | RegExp>;
  
    /**
     * Exclude methods from Open API
     */
    excludeMethods?: (typeof ALLOWED_METHODS)[number][];
  
    /**
     * Exclude tags from OpenAPI
     */
    excludeTags?: string[];
};