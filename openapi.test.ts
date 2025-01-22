import { PhatsAPI } from "./phatsapi.ts"; // Replace with the actual path to your API file
import { z } from "npm:zod";
import { extendZodWithOpenApi } from "npm:zod-openapi";
import SwaggerParser from "npm:@apidevtools/swagger-parser";

extendZodWithOpenApi(z);

// Example usage within a Deno test
Deno.test("OpenAPI specification validation", async () => {
    // 1. Define your API with routes and schemas
    const api = new PhatsAPI({
        documentation: {
            info: {
                title: "My Test API",
                version: "1.0.0",
            },
        },
    });

    // Example schema
    const UserSchema = z
        .object({
            id: z.number().openapi({ example: 123 }),
            name: z.string().openapi({ example: "John Doe" }),
        })
        .openapi({ ref: "User" });

    const CreateUserSchema = {
        json: z
            .object({
                name: z.string().openapi({ example: "Jane Doe" }),
            })
            .openapi({ ref: "CreateUser" }),
    };

    // Example route
    api.get(
        "/users/:id",
        {
            param: z
                .object({ id: z.coerce.number().openapi({ example: 123 }) })
                .openapi({ ref: "GetUserParams" }),
        }, // Corrected: Use { ref: 'GetUserParams' }
        UserSchema,
        "Get a user by ID",
        async (req) => ({ id: req.id, name: "Test User" })
    );

    api.post(
        "/users",
        CreateUserSchema,
        UserSchema,
        "Create a new user",
        async (req) => ({ id: 123, name: req.name })
    );

    // 2. Fetch the OpenAPI specification
    const response = await api.fetch(new Request("http://localhost/openapi"));
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

    // Example: Validate /users/:id GET endpoint
    Deno.test("Validate /users/:id GET endpoint", () => {
        const userPath = openapiSpec.paths["/users/{id}"];
        if (!userPath) {
            throw new Error("Missing '/users/{id}' path in OpenAPI spec");
        }

        const getOperation = userPath.get;
        if (!getOperation) {
            throw new Error("Missing 'get' operation for '/users/{id}'");
        }

        // Validate parameters
        if (!getOperation.parameters || getOperation.parameters.length !== 1) {
            throw new Error("Expected 1 parameter for '/users/{id}' GET");
        }

        const idParam = getOperation.parameters[0];

        if (
            idParam.name !== "id" ||
            idParam.in !== "path" ||
            idParam.schema.type !== "integer"
        ) {
            throw new Error(
                "Invalid 'id' parameter definition for '/users/{id}' GET"
            );
        }

        // Validate 200 response
        const response200 = getOperation.responses["200"];
        if (!response200) {
            throw new Error("Missing '200' response for '/users/{id}' GET");
        }

        if (
            response200.content["application/json"].schema.$ref !==
            "#/components/schemas/User"
        ) {
            throw new Error(
                "Response schema for '/users/{id}' GET is incorrect"
            );
        }
    });

    // Example: Validate /users POST endpoint
    Deno.test("Validate /users POST endpoint", () => {
        const usersPath = openapiSpec.paths["/users"];
        if (!usersPath) {
            throw new Error("Missing '/users' path in OpenAPI spec");
        }

        const postOperation = usersPath.post;
        if (!postOperation) {
            throw new Error("Missing 'post' operation for '/users'");
        }

        // Validate request body
        const requestBody = postOperation.requestBody;

        if (!requestBody) {
            throw new Error("Missing 'requestBody' for '/users' POST");
        }

        if (
            requestBody.content["application/json"].schema.$ref !==
            "#/components/schemas/CreateUser"
        ) {
            throw new Error(
                "Request body schema for '/users' POST is incorrect"
            );
        }

        // Validate 200 response
        const response200 = postOperation.responses["200"];

        if (!response200) {
            throw new Error("Missing '200' response for '/users' POST");
        }

        if (
            response200.content["application/json"].schema.$ref !==
            "#/components/schemas/User"
        ) {
            throw new Error("Response schema for '/users' POST is incorrect");
        }
    });

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
    });

    // Example: Validate CreateUser schema
    Deno.test("Validate CreateUser schema", () => {
        const createUserSchema = openapiSpec.components.schemas.CreateUser;
        if (!createUserSchema) {
            throw new Error("Missing 'CreateUser' schema in OpenAPI spec");
        }

        if (createUserSchema.type !== "object") {
            throw new Error("'CreateUser' schema should be of type 'object'");
        }

        if (
            !createUserSchema.properties.name ||
            createUserSchema.properties.name.type !== "string"
        ) {
            throw new Error(
                "'CreateUser' schema should have a 'name' property of type 'string'"
            );
        }
    });

    // Sanity Check with External Validator
    Deno.test("External OpenAPI Schema Validation (Sanity Check)", async () => {
        try {
            await SwaggerParser.validate(openapiSpec); // Validate the spec
            console.log(
                "OpenAPI spec is valid (validated with @apidevtools/swagger-parser)"
            );
        } catch (err) {
            throw new Error(`OpenAPI validation failed: ${err}`);
        }
    });
});
