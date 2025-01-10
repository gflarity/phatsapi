import { z } from 'npm:zod';
import { extendZodWithOpenApi } from 'npm:zod-openapi'
import { PhatsAPI } from './phatsapi.ts';
import { assertEquals, assertExists } from "jsr:@std/assert";

extendZodWithOpenApi(z)

// ----- Example Usage -----
// Request schema for getting a user
export const GetUserRequestSchema = z
  .object({
    userId: z
      .string()
      .uuid()
      .openapi({
        param: {
            name: 'userId',
            in: 'path',
        },
        description: "Unique identifier for the user to be fetched.",
        example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",        
      }),
  })
  .openapi({ ref: "GetUserRequest" }); // Assign a unique name for referencing

// Response schema for getting a user
export const GetUserResponseSchema = z
  .object({
    userId: z
      .string()
      .uuid()
      .openapi({
        description: "Unique identifier for the user.",
        example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      }),
    name: z
      .string()
      .openapi({
        description: "Name of the user.",
        example: "John Doe",
      }),
    email: z
      .string()
      .email()
      .openapi({
        description: "Email address of the user.",
        example: "john.doe@example.com",
      }),
    isActive: z
      .boolean()
      .openapi({
        description: "Indicates if the user is active.",
        example: true,
      }),
  })
  .openapi({ ref: "GetUserResponse"}); // Assign a unique name for referencing

// Test cases (in phats-api.test.ts)
Deno.test("PhatsAPI GET method", async () => {
    const api = new PhatsAPI({
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
    const requestSchema = z.object({
        name: z.string().openapi({example: 'John Doe'}),
    })
    const responseSchema = z.object({
        message: z.string().openapi({example: 'Hello, John Doe!'}),
    })

    api.get(
        "/hello",
        requestSchema,
        responseSchema,
        "Greets the user",
        async (req) => {
            return { message: `Hello, ${req.name}!` }
        }
    )

    const res = await api.fetch(new Request("http://localhost:8080/hello?name=John%20Doe"))
    assertEquals(res.status, 200)
    const body = await res.json()
    assertEquals(body, { message: "Hello, John Doe!" })
})

Deno.test("PhatsAPI GET method - invalid request", async () => {
    const api = new PhatsAPI({
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
    const requestSchema = z.object({
        name: z.string().openapi({example: 'John Doe'}),
    })
    const responseSchema = z.object({
        message: z.string().openapi({example: 'Hello, John Doe!'}),
    })

    api.get(
        "/hello",
        requestSchema,
        responseSchema,
        "Greets the user",
        async (req) => {
            return { message: `Hello, ${req.name}!` }
        }
    )

    const res = await api.fetch(new Request("http://localhost:8080/hello")) // Missing 'name' query parameter
    assertEquals(res.status, 400)
})

Deno.test("PhatsAPI POST method normal", async () => {
    const api = new PhatsAPI({
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
    const requestSchema = z.object({
        name: z.string().openapi({example: 'Jane Doe'}),
    })
    const responseSchema = z.object({
        id: z.number().openapi({example: 1}),
        name: z.string().openapi({example: 'Jane Doe'}),
    })

    api.post(
        "/users",
        requestSchema,
        responseSchema,
        "Creates a new user",
        async (req) => {
            return { id: 1, name: req.name }
        }
    )

    const res = await api.fetch(new Request("http://localhost:8080/users", {
        method: "POST",
        body: JSON.stringify({ name: "Jane Doe" }),
        headers: { "Content-Type": "application/json" },
    }))
    assertEquals(res.status, 200)
    const body = await res.json()
    assertEquals(body, { id: 1, name: "Jane Doe" })
})

Deno.test("PhatsAPI POST method - invalid request", async () => {
    const api = new PhatsAPI({
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
    const requestSchema = z.object({
        name: z.string().openapi({example: 'Jane Doe'}),
    })
    const responseSchema = z.object({
        id: z.number().openapi({example: 1}),
        name: z.string().openapi({example: 'Jane Doe'}),
    })

    api.post(
        "/users",
        requestSchema,
        responseSchema,
        "Creates a new user",
        async (req) => {
            return { id: 1, name: req.name }
        }
    )

    const res = await api.fetch(new Request("http://localhost:8080/users", {
        method: "POST",
        body: JSON.stringify({}), // Missing 'name' in body
        headers: { "Content-Type": "application/json" },
    }))
    assertEquals(res.status, 400)
})

Deno.test("PhatsAPI openapi endpoint", async () => {

    const api = new PhatsAPI({
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
    const res = await api.fetch(new Request("http://localhost:8080/openapi"))
    assertEquals(res.status, 200)
    const body = await res.json()
    assertExists(body.openapi)
    assertEquals(body.info.title, "Hono")
    assertEquals(body.info.version, "1.0.0")
})


Deno.test("PhatsAPI PUT method - normal", async () => {
    const api = new PhatsAPI({
        documentation: {
            info: {
                title: "User API",
                version: "1.0.0",
                description: "API for managing users",
            },
            servers: [
                {
                    url: "http://localhost:3000",
                    description: "Local server",
                },
            ],
        },
    });

    const requestSchema = z.object({
        name: z.string().openapi({ example: 'Updated Name' }),
    });

    const responseSchema = z.object({
        id: z.number().openapi({ example: 1 }),
        name: z.string().openapi({ example: 'Updated Name' }),
    });

    api.put(
        "/users/1",
        requestSchema,
        responseSchema,
        "Updates a user",
        async (req) => {
            return { id: 1, name: req.name };
        }
    );

    const res = await api.fetch(new Request("http://localhost:8080/users/1", {
        method: "PUT",
        body: JSON.stringify({ name: "Updated Name" }),
        headers: { "Content-Type": "application/json" },
    }));

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body, { id: 1, name: "Updated Name" });
});

Deno.test("PhatsAPI PUT method - invalid request", async () => {
    const api = new PhatsAPI({
        documentation: {
            info: {
                title: "User API",
                version: "1.0.0",
                description: "API for managing users",
            },
            servers: [
                {
                    url: "http://localhost:3000",
                    description: "Local server",
                },
            ],
        },
    });

    const requestSchema = z.object({
        name: z.string().openapi({ example: 'Updated Name' }),
    });

    const responseSchema = z.object({
        id: z.number().openapi({ example: 1 }),
        name: z.string().openapi({ example: 'Updated Name' }),
    });

    api.put(
        "/users/1",
        requestSchema,
        responseSchema,
        "Updates a user",
        async (req) => {
            return { id: 1, name: req.name };
        }
    );

    const res = await api.fetch(new Request("http://localhost:8080/users/1", {
        method: "PUT",
        body: JSON.stringify({}), // Missing 'name' in body
        headers: { "Content-Type": "application/json" },
    }));

    assertEquals(res.status, 400);
});

Deno.test("PhatsAPI DELETE method - normal", async () => {
    const api = new PhatsAPI({
        documentation: {
            info: {
                title: "User API",
                version: "1.0.0",
                description: "API for managing users",
            },
            servers: [
                {
                    url: "http://localhost:3000",
                    description: "Local server",
                },
            ],
        },
    });

    // For DELETE, we might not always need a request body, but for consistency, let's assume we pass an ID in the body
    const requestSchema = z.object({
        id: z.number().openapi({ example: 1 }),
    });

    const responseSchema = z.object({
        message: z.string().openapi({ example: 'User deleted' }),
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

    const res = await api.fetch(new Request("http://localhost:8080/users", {
        method: "DELETE",
        body: JSON.stringify({ id: 1 }),
        headers: { "Content-Type": "application/json" },
    }));

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body, { message: 'User deleted' });
});

Deno.test("PhatsAPI DELETE method - invalid request", async () => {
    const api = new PhatsAPI({
        documentation: {
            info: {
                title: "User API",
                version: "1.0.0",
                description: "API for managing users",
            },
            servers: [
                {
                    url: "http://localhost:3000",
                    description: "Local server",
                },
            ],
        },
    });

    const requestSchema = z.object({
        id: z.number().openapi({ example: 1 }),
    });

    const responseSchema = z.object({
        message: z.string().openapi({ example: 'User deleted' }),
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

    const res = await api.fetch(new Request("http://localhost:8080/users", {
        method: "DELETE",
        body: JSON.stringify({}), // Missing 'id' in the body
        headers: { "Content-Type": "application/json" },
    }));

    assertEquals(res.status, 400);
});