import { PhatsAPI } from "./phatsapi.ts"; // Replace with the actual path to your API file
import { z } from "npm:zod";
import { extendZodWithOpenApi } from "npm:zod-openapi";
import SwaggerParser from "npm:@apidevtools/swagger-parser";

extendZodWithOpenApi(z);

Deno.test(
    "OpenAPI specification validation - Comprehensive Parameter and Body Testing",
    async () => {
        // 1. Define your API with routes and schemas
        const api = new PhatsAPI({
            documentation: {
                info: {
                    title: "My Test API",
                    version: "1.0.0",
                },
            },
        });

        // --- Schemas ---

        const UserSchema = z
            .object({
                id: z.number().openapi({ example: 123 }),
                name: z.string().openapi({ example: "John Doe" }),
                email: z.string().email().optional().openapi({
                    example: "john.doe@example.com",
                }),
            })
            .openapi({ ref: "User" });

        const ProductSchema = z
            .object({
                id: z.number().openapi({ example: 456 }),
                name: z.string().openapi({ example: "Awesome Product" }),
                price: z.number().openapi({ example: 99.99 }),
            })
            .openapi({ ref: "Product" });

        const OrderSchema = z
            .object({
                orderId: z.number().openapi({ example: 789 }),
                userId: z.number().openapi({ example: 123 }),
                products: z.array(ProductSchema),
                totalAmount: z.number().openapi({ example: 199.98 }),
                status: z
                    .enum(["pending", "processing", "shipped", "delivered"])
                    .openapi({ example: "pending" }),
            })
            .openapi({ ref: "Order" });

        // --- Request Schemas (for reusability) ---

        const GetUserParamsSchema = z
            .object({
                userId: z.coerce.number().openapi({
                    example: 123,
                    description: "ID of the user to retrieve",
                }),
            })
            .openapi({ ref: "GetUserParams" });

        const SearchUsersQuerySchema = z
            .object({
                query: z.string().optional().openapi({
                    example: "John",
                    description: "Search query for filtering users by name",
                }),
                limit: z.number().optional().openapi({
                    example: 10,
                    description: "Maximum number of users to return",
                }),
                isActive: z.boolean().optional().openapi({
                    example: true,
                    description: "Filter users based on their active status",
                }),
            })
            .openapi({ ref: "SearchUsersQuery" });

        const CreateUserJsonSchema = z
            .object({
                name: z.string().openapi({ example: "Jane Doe" }),
                email: z.string().email().openapi({
                    example: "jane.doe@example.com",
                }),
            })
            .openapi({ ref: "CreateUserJson" });

        const UpdateProductJsonSchema = z
            .object({
                name: z.string().optional().openapi({
                    example: "Even More Awesome Product",
                }),
                price: z.number().optional().openapi({ example: 149.99 }),
            })
            .openapi({ ref: "UpdateProductJson" });

        const CreateOrderJsonSchema = z
            .object({
                userId: z.number().openapi({ example: 123 }),
                products: z.array(z.number()).openapi({
                    example: [456, 789],
                    description: "Array of product IDs",
                }),
            })
            .openapi({ ref: "CreateOrderJson" });

        // --- API Routes ---

        // GET /users/:userId (Path Parameter)
        api.get(
            "/users/:userId",
            { param: GetUserParamsSchema },
            UserSchema,
            "Get a user by ID",
            async (req) => ({
                id: req.userId,
                name: "Test User",
                email: "test@example.com",
            })
        );

        // GET /users (Query Parameters)
        api.get(
            "/users",
            { query: SearchUsersQuerySchema },
            z.array(UserSchema),
            "Search for users",
            async (req) => {
                console.log(
                    `Searching for users with query: ${req.query}, limit: ${req.limit}, isActive: ${req.isActive}`
                );
                return []; // Return an empty array for testing
            }
        );

        // POST /users (JSON Body)
        api.post(
            "/users",
            { json: CreateUserJsonSchema },
            UserSchema,
            "Create a new user",
            async (req) => ({ id: 123, name: req.name, email: req.email })
        );

        // PUT /products/:productId (Path Parameter and JSON Body)
        api.put(
            "/products/:productId",
            {
                param: z.object({
                    productId: z.coerce.number().openapi({ example: 456 }),
                }),
                json: UpdateProductJsonSchema,
            },
            ProductSchema,
            "Update a product",
            async (req) => ({
                id: req.productId,
                name: req.name ?? "Awesome Product",
                price: req.price ?? 99.99,
            })
        );

        // DELETE /users/:userId (Path Parameter)
        api.delete(
            "/users/:userId",
            {
                param: z.object({
                    userId: z.coerce.number().openapi({ example: 123 }),
                }),
            },
            z.object({ message: z.string() }),
            "Delete a user",
            async (req) => ({ message: `User ${req.userId} deleted` })
        );

        // POST /orders (JSON Body with Array)
        api.post(
            "/orders",
            { json: CreateOrderJsonSchema },
            OrderSchema,
            "Create a new order",
            async (req) => ({
                orderId: 789,
                userId: req.userId,
                products: req.products.map((id) => ({
                    id,
                    name: "Product Name",
                    price: 10,
                })), // Dummy product data
                totalAmount: req.products.length * 10,
                status: "pending" as const, // Now correctly sets the status
            })
        );

        // GET /products/:productId/reviews (Path Parameter and Query Parameters)
        api.get(
            "/products/:productId/reviews",
            {
                param: z.object({
                    productId: z.coerce.number().openapi({ example: 456 }),
                }),
                query: z.object({
                    limit: z.number().optional().openapi({ example: 5 }),
                    sortBy: z.enum(["date", "rating"]).optional().openapi({
                        example: "date",
                    }),
                }),
            },
            z.array(z.object({ review: z.string() })),
            "Get reviews for a product",
            async (req) => {
                console.log(
                    `Getting reviews for product ${req.productId}, limit: ${req.limit}, sortBy: ${req.sortBy}`
                );
                return [
                    { review: "Great product!" },
                    { review: "Could be better." },
                ];
            }
        );

        // 2. Fetch the OpenAPI specification
        const response = await api.fetch(
            new Request("http://localhost/openapi")
        );
        const openapiSpec = await response.json();

        // 3. Validate the structure (basic assertions)

        // Check for required top-level properties
        Deno.test("Has openapi version", () => {
            if (!("openapi" in openapiSpec)) {
                throw new Error("Missing 'openapi' property in OpenAPI spec");
            }
        });

        Deno.test("Has info object", () => {
            if (!("info" in openapiSpec)) {
                throw new Error("Missing 'info' property in OpenAPI spec");
            }
        });

        Deno.test("Has paths object", () => {
            if (!("paths" in openapiSpec)) {
                throw new Error("Missing 'paths' property in OpenAPI spec");
            }
        });

        // 4. Validate specific parts (more detailed assertions)

        // --- Helper function for parameter validation ---
        function validateParameter(
            parameter: any,
            name: string,
            inType: "query" | "path" | "header" | "cookie",
            type: string,
            required: boolean,
            description?: string
        ) {
            if (parameter.name !== name) {
                throw new Error(
                    `Parameter name mismatch. Expected '${name}', got '${parameter.name}'`
                );
            }
            if (parameter.in !== inType) {
                throw new Error(
                    `Parameter 'in' type mismatch for '${name}'. Expected '${inType}', got '${parameter.in}'`
                );
            }
            if (parameter.schema.type !== type) {
                throw new Error(
                    `Parameter schema type mismatch for '${name}'. Expected '${type}', got '${parameter.schema.type}'`
                );
            }
            if (parameter.required !== required) {
                throw new Error(
                    `Parameter 'required' mismatch for '${name}'. Expected ${required}, got ${parameter.required}`
                );
            }
            if (description && parameter.description !== description) {
                throw new Error(
                    `Parameter description mismatch for '${name}'. Expected '${description}', got '${parameter.description}'`
                );
            }
        }

        // --- Parameter and Request Body Validation ---

        // GET /users/:userId
        Deno.test("Validate /users/:userId parameters", () => {
            const getOperation = openapiSpec.paths["/users/{userId}"].get;
            const userIdParam = getOperation.parameters[0];
            validateParameter(userIdParam, "userId", "path", "integer", true);
        });

        // GET /users
        Deno.test("Validate /users parameters", () => {
            const getOperation = openapiSpec.paths["/users"].get;
            const queryParam = getOperation.parameters.find(
                (p: any) => p.name === "query"
            );
            const limitParam = getOperation.parameters.find(
                (p: any) => p.name === "limit"
            );
            const isActiveParam = getOperation.parameters.find(
                (p: any) => p.name === "isActive"
            );

            validateParameter(queryParam, "query", "query", "string", false);
            validateParameter(limitParam, "limit", "query", "integer", false);
            validateParameter(
                isActiveParam,
                "isActive",
                "query",
                "boolean",
                false
            );
        });

        // POST /users
        Deno.test("Validate /users request body", () => {
            const postOperation = openapiSpec.paths["/users"].post;
            const requestBody = postOperation.requestBody;
            if (
                requestBody.content["application/json"].schema.$ref !==
                "#/components/schemas/CreateUserJson"
            ) {
                throw new Error(
                    "Request body schema for '/users' POST is incorrect"
                );
            }
        });

        // PUT /products/:productId
        Deno.test(
            "Validate /products/:productId parameters and request body",
            () => {
                const putOperation =
                    openapiSpec.paths["/products/{productId}"].put;
                const productIdParam = putOperation.parameters[0];
                validateParameter(
                    productIdParam,
                    "productId",
                    "path",
                    "integer",
                    true
                );

                const requestBody = putOperation.requestBody;
                if (
                    requestBody.content["application/json"].schema.$ref !==
                    "#/components/schemas/UpdateProductJson"
                ) {
                    throw new Error(
                        "Request body schema for '/products/:productId' PUT is incorrect"
                    );
                }
            }
        );

        // DELETE /users/:userId
        Deno.test("Validate /users/:userId parameters", () => {
            const deleteOperation = openapiSpec.paths["/users/{userId}"].delete;
            const userIdParam = deleteOperation.parameters[0];
            validateParameter(userIdParam, "userId", "path", "integer", true);
        });

        // POST /orders
        Deno.test("Validate /orders request body", () => {
            const postOperation = openapiSpec.paths["/orders"].post;
            const requestBody = postOperation.requestBody;
            if (
                requestBody.content["application/json"].schema.$ref !==
                "#/components/schemas/CreateOrderJson"
            ) {
                throw new Error(
                    "Request body schema for '/orders' POST is incorrect"
                );
            }
        });

        // GET /products/:productId/reviews
        Deno.test("Validate /products/:productId/reviews parameters", () => {
            const getOperation =
                openapiSpec.paths["/products/{productId}/reviews"].get;
            const productIdParam = getOperation.parameters.find(
                (p: any) => p.name === "productId"
            );
            const limitParam = getOperation.parameters.find(
                (p: any) => p.name === "limit"
            );
            const sortByParam = getOperation.parameters.find(
                (p: any) => p.name === "sortBy"
            );

            validateParameter(
                productIdParam,
                "productId",
                "path",
                "integer",
                true
            );
            validateParameter(limitParam, "limit", "query", "integer", false);
            validateParameter(sortByParam, "sortBy", "query", "string", false);
        });

        // --- Other Validations (Response Schemas, etc.) ---

        // Example: Validate User schema
        Deno.test("Validate User schema", () => {
            const userSchema = openapiSpec.components.schemas.User;
            if (!userSchema) {
                throw new Error("Missing 'User' schema in OpenAPI spec");
            }

            if (userSchema.type !== "object") {
                throw new Error("'User' schema should be of type 'object'");
            }

            if (
                !userSchema.properties.id ||
                userSchema.properties.id.type !== "integer"
            ) {
                throw new Error(
                    "'User' schema should have an 'id' property of type 'integer'"
                );
            }

            if (
                !userSchema.properties.name ||
                userSchema.properties.name.type !== "string"
            ) {
                throw new Error(
                    "'User' schema should have a 'name' property of type 'string'"
                );
            }

            if (userSchema.properties.email?.type !== "string") {
                throw new Error(
                    "'User' schema 'email' property should be of type 'string' if it exists"
                );
            }
        });

        // Example: Validate CreateUserJson schema
        Deno.test("Validate CreateUserJson schema", () => {
            const createUserSchema =
                openapiSpec.components.schemas.CreateUserJson;
            if (!createUserSchema) {
                throw new Error(
                    "Missing 'CreateUserJson' schema in OpenAPI spec"
                );
            }

            if (createUserSchema.type !== "object") {
                throw new Error(
                    "'CreateUserJson' schema should be of type 'object'"
                );
            }

            if (
                !createUserSchema.properties.name ||
                createUserSchema.properties.name.type !== "string"
            ) {
                throw new Error(
                    "'CreateUserJson' schema should have a 'name' property of type 'string'"
                );
            }

            if (
                !createUserSchema.properties.email ||
                createUserSchema.properties.email.type !== "string"
            ) {
                throw new Error(
                    "'CreateUserJson' schema should have an 'email' property of type 'string'"
                );
            }
        });

        // Sanity Check with External Validator
        Deno.test(
            "External OpenAPI Schema Validation (Sanity Check)",
            async () => {
                try {
                    await SwaggerParser.validate(openapiSpec); // Validate the spec
                    console.log(
                        "OpenAPI spec is valid (validated with @apidevtools/swagger-parser)"
                    );
                } catch (err) {
                    throw new Error(`OpenAPI validation failed: ${err}`);
                }
            }
        );
    }
);
