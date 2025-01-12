import { z } from 'npm:zod';
import { extendZodWithOpenApi } from 'npm:zod-openapi'
import { PhatsAPI } from './phatsapi.ts';
import { assertEquals, assertExists } from "jsr:@std/assert";

extendZodWithOpenApi(z)

// Helper function to create a PhatsAPI instance
function createTestAPI(title: string = "PhatsAPI") {
    return new PhatsAPI({
        documentation: {
            info: {
                title: title,
                version: "1.0.0",
                description: "API for testing",
            },
            servers: [
                {
                    url: "http://localhost:3000",
                    description: "Local server",
                },
            ],
        },
    });
}

// Helper function to perform a request and validate the response
async function testRequest(
    api: PhatsAPI,
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    requestOptions: RequestInit = {},
    expectedStatus: number,
    expectedBody?: unknown
) {
    const res = await api.fetch(new Request(`http://localhost:8080${path}`, {
        method,
        ...requestOptions,
    }));
    assertEquals(res.status, expectedStatus);
    if (expectedBody) {
        const body = await res.json();
        assertEquals(body, expectedBody);
    }
}

// Reusable schemas
const userNameSchema = z.string().openapi({ example: 'John Doe' });
const userIdSchema = z.number().openapi({ example: 1 });
const userSchema = z.object({
    id: userIdSchema,
    name: userNameSchema,
});
const messageSchema = z.string().openapi({ example: 'Operation successful' });

Deno.test("PhatsAPI GET method", async () => {
    const api = createTestAPI("Greeting API");
    const requestSchema = z.object({
        name: userNameSchema,
    });
    const responseSchema = z.object({
        message: z.string().openapi({ example: 'Hello, John Doe!' }),
    });

    api.get(
        "/hello",
        requestSchema,
        responseSchema,
        "Greets the user",
        async (req) => {
            return { message: `Hello, ${req.name}!` };
        }
    );

    await testRequest(api, "GET", "/hello?name=John%20Doe", {}, 200, { message: "Hello, John Doe!" });
    await testRequest(api, "GET", "/hello", {}, 400); // Missing 'name'
});

Deno.test("PhatsAPI POST method", async () => {
    const api = createTestAPI();
    const requestSchema = z.object({
        name: userNameSchema,
    });
    const responseSchema = userSchema;

    api.post(
        "/users",
        requestSchema,
        responseSchema,
        "Creates a new user",
        async (req) => {
            return { id: 1, name: req.name };
        }
    );

    await testRequest(api, "POST", "/users", {
        body: JSON.stringify({ name: "Jane Doe" }),
        headers: { "Content-Type": "application/json" },
    }, 200, { id: 1, name: "Jane Doe" });
    await testRequest(api, "POST", "/users", {
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
    }, 400); // Missing 'name'
});

Deno.test("PhatsAPI POST method - path param", async () => {
    const UpdateUserWithPathRequest = z.object({
        userId: z.string().uuid().openapi({
            param: {
                name: 'userId',
                in: 'path',
            },
            description: "Unique identifier for the user to be fetched.",
            example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",        
        }),
        name: z.string().openapi({
            description: "Name of the user.",
            example: "John Doe",
        }),
        email: z.string().email().openapi({
            description: "Email address of the user.",
            example: "john.doe@example.com",
        }),
        isActive: z.boolean().openapi({
            description: "Indicates if the user is active.",
            example: true,
        }),
    }).openapi({ ref: "GetUserRequest" }); // Assign a unique name for referencing

    // Response schema for getting a user
    const UpdateUserResponse = z.object({
        userId: z.string().uuid().openapi({
            description: "Unique identifier for the user.",
            example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        }),
        name: z.string().openapi({
            description: "Name of the user.",
            example: "John Doe",
        }),
        email: z.string().email().openapi({
            description: "Email address of the user.",
            example: "john.doe@example.com",
        }),
        isActive: z.boolean().openapi({
            description: "Indicates if the user is active.",
            example: true,
        }),
    }).openapi({ ref: "GetUserResponse"}); // Assign a unique name for referencing

    const api = createTestAPI()

    api.post(
        "/users/:userId",
        UpdateUserWithPathRequest,
        UpdateUserResponse,
        "Creates a new user",
        async (req) => {
            return { userId: req.userId, name: req.name,  email: req.email, isActive: req.isActive }
        }
    )
    await testRequest(api, "POST", "/users/f47ac10b-58cc-4372-a567-0e02b2c3d47a", {
        body: JSON.stringify({ name: "Jane Doe", email: "jane@doe.com", isActive: true }),
        headers: { "Content-Type": "application/json" },
    }, 200)
})

Deno.test("PhatsAPI PUT method", async () => {
    const api = createTestAPI("User Management API");
    const requestSchema = z.object({
        name: userNameSchema,
    });
    const responseSchema = userSchema;

    api.put(
        "/users/1",
        requestSchema,
        responseSchema,
        "Updates a user",
        async (req) => {
            return { id: 1, name: req.name };
        }
    );

    await testRequest(api, "PUT", "/users/1", {
        body: JSON.stringify({ name: "Updated Name" }),
        headers: { "Content-Type": "application/json" },
    }, 200, { id: 1, name: "Updated Name" });
    await testRequest(api, "PUT", "/users/1", {
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
    }, 400); // Missing 'name'
});

Deno.test("PhatsAPI DELETE method", async () => {
    const api = createTestAPI("User API");
    const requestSchema = z.object({
        id: userIdSchema,
    });
    const responseSchema = z.object({
        message: messageSchema,
    });

    api.delete(
        "/users",
        requestSchema,
        responseSchema,
        "Deletes a user",
        async (req) => {
            return { message: 'User deleted' };
        }
    );

    await testRequest(api, "DELETE", "/users", {
        body: JSON.stringify({ id: 1 }),
        headers: { "Content-Type": "application/json" },
    }, 200, { message: 'User deleted' });
    await testRequest(api, "DELETE", "/users", {
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
    }, 400); // Missing 'id'
});

Deno.test("PhatsAPI openapi endpoint", async () => {
    const api = createTestAPI();
    const res = await api.fetch(new Request("http://localhost:8080/openapi"));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertExists(body.openapi);
    assertEquals(body.info.title, "PhatsAPI");
    assertEquals(body.info.version, "1.0.0");
});