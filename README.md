![phatsapi](https://github.com/user-attachments/assets/da3d6ad9-bc4a-4d85-a0d6-730f41e0df3b)

# PhatsAPI - Deno API Framework

PhatsAPI is a lightweight and easy-to-use Deno API framework that allows you to define your API endpoints using Zod schemas. It automatically generates OpenAPI 3.0 documentation based on your schemas, so you don't have to write any additional documentation. It's based on [Hono](https://www.npmjs.com/package/hono) and [hono-openapi](https://jsr.io/@hono-openapi/hono-openapi).

## Setup

import { PhatsAPI } from "@phatsapi/phatsapi"

## Example

```ts
import { PhatsAPI } from "../phatsapi.ts";
import { z } from "npm:zod";
import { bearerAuth } from "npm:hono/bearer-auth";

import { extendZodWithOpenApi } from "npm:zod-openapi@4.2.2";
extendZodWithOpenApi(z);

const api = new PhatsAPI({
    documentation: {
        info: {
            title: "My API",
            version: "1.0.0",
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Local server",
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "OpagueToken",
                },
            },
        },
    },
});

api.use(bearerAuth({ token: "phatsrocks" }));

// Define schemas for request and response
const createUserSchema = z.object({
    name: z.string(),
    email: z.string().email(),
});

const updateUserPathSchema = z.object({
    id: z.string(),
});

const requestSchema = z.object({
    id: z.string(),
});

const userSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
});

// Create a POST endpoint to create a user
api.post(
    "/users",
    createUserSchema, // json body is the default source if you don't use CompoundRequest type
    userSchema,
    "Create a new user",
    async (req) => {
        // TypeScript automatically infers the type of `req` as:
        // `z.infer<typeof createUserSchema>`
        // which is equivalent to: { name: string; email: string; }

        // The return type is also automatically inferred as:
        // `z.infer<typeof userSchema>`
        // which is equivalent to: { id: string; name: string; email: string; }

        // Replace this with your actual user creation logic
        const userId = "user123"; // Generate a unique ID
        const user = {
            id: userId,
            name: req.name,
            email: req.email,
        };
        // Simulate asynchronous operation (e.g., database insertion)
        await new Promise((resolve) => setTimeout(resolve, 100));
        return user;
    }
);

// Create a PUT endpoint to update a user
api.put(
    "/users/:id",
    { param: updateUserPathSchema, json: createUserSchema },
    userSchema,
    "Update a user",
    async (req) => {
        // TypeScript automatically infers the type of `req` as:
        // `z.infer<typeof updateUserSchema>`
        // which is equivalent to: { id: string; name?: string | undefined; email?: string | undefined; }

        // The return type is also automatically inferred as:
        // `z.infer<typeof userSchema>`
        // which is equivalent to: { id: string; name: string; email: string; }

        // Replace this with your actual user update logic
        const updatedUser = {
            id: req.id,
            name: req.name ?? "John Doe",
            email: req.email ?? "johndoe@example.com",
        };
        // Simulate asynchronous operation (e.g., database update)
        await new Promise((resolve) => setTimeout(resolve, 100));
        return updatedUser;
    }
);

// Create a GET endpoint to fetch a user by ID
api.get(
    "/users/:id",
    { param: requestSchema },
    userSchema,
    "Get a user by ID",
    async (req) => {
        // TypeScript automatically infers the type of `req` as:
        // `z.infer<typeof requestSchema>`
        // which is equivalent to: { id: string; }

        // The return type is also automatically inferred as:
        // `z.infer<typeof userSchema>`
        // which is equivalent to: { id: string; name: string; email: string; }

        // Replace this with your actual data fetching logic
        const user = {
            id: req.id,
            name: "John Doe",
            email: "johndoe@example.com",
        };
        return user;
    }
);

// Start the server
Deno.serve({ hostname: "localhost", port: 3000 }, api.fetch);
```

Now take a look at your schema using `curl http://localhost:3000/openapi | jq`:

```json
{
    "openapi": "3.1.0",
    "info": {
        "title": "My API",
        "description": "Development documentation",
        "version": "1.0.0"
    },
    "servers": [
        {
            "url": "http://localhost:3000",
            "description": "Local server"
        }
    ],
    "components": {
        "securitySchemes": {
            "bearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "OpagueToken"
            }
        },
        "schemas": {}
    },
    "paths": {
        "/users": {
            "post": {
                "responses": {
                    "200": {
                        "description": "Successful response",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "id": {
                                            "type": "string"
                                        },
                                        "name": {
                                            "type": "string"
                                        },
                                        "email": {
                                            "type": "string",
                                            "format": "email"
                                        }
                                    },
                                    "required": ["id", "name", "email"]
                                }
                            }
                        }
                    },
                    "400": {
                        "description": "Bad request",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "errors": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "field": {
                                                        "type": "string"
                                                    },
                                                    "message": {
                                                        "type": "string"
                                                    }
                                                },
                                                "required": ["field", "message"]
                                            }
                                        }
                                    },
                                    "required": ["errors"]
                                }
                            }
                        }
                    },
                    "500": {
                        "description": "Internal server error",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "error": {
                                            "type": "string"
                                        }
                                    },
                                    "required": ["error"]
                                }
                            }
                        }
                    }
                },
                "operationId": "postUsers",
                "description": "Create a new user",
                "parameters": [],
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "name": {
                                        "type": "string"
                                    },
                                    "email": {
                                        "type": "string",
                                        "format": "email"
                                    }
                                },
                                "required": ["name", "email"]
                            }
                        }
                    }
                }
            }
        },
        "/users/{id}": {
            "put": {
                "responses": {
                    "200": {
                        "description": "Successful response",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "id": {
                                            "type": "string"
                                        },
                                        "name": {
                                            "type": "string"
                                        },
                                        "email": {
                                            "type": "string",
                                            "format": "email"
                                        }
                                    },
                                    "required": ["id", "name", "email"]
                                }
                            }
                        }
                    },
                    "400": {
                        "description": "Bad request",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "errors": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "field": {
                                                        "type": "string"
                                                    },
                                                    "message": {
                                                        "type": "string"
                                                    }
                                                },
                                                "required": ["field", "message"]
                                            }
                                        }
                                    },
                                    "required": ["errors"]
                                }
                            }
                        }
                    },
                    "500": {
                        "description": "Internal server error",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "error": {
                                            "type": "string"
                                        }
                                    },
                                    "required": ["error"]
                                }
                            }
                        }
                    }
                },
                "operationId": "putUsersById",
                "description": "Update a user",
                "parameters": [
                    {
                        "schema": {
                            "type": "string"
                        },
                        "in": "path",
                        "name": "id",
                        "required": true
                    }
                ],
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "name": {
                                        "type": "string"
                                    },
                                    "email": {
                                        "type": "string",
                                        "format": "email"
                                    }
                                },
                                "required": ["name", "email"]
                            }
                        }
                    }
                }
            },
            "get": {
                "responses": {
                    "200": {
                        "description": "Successful response",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "id": {
                                            "type": "string"
                                        },
                                        "name": {
                                            "type": "string"
                                        },
                                        "email": {
                                            "type": "string",
                                            "format": "email"
                                        }
                                    },
                                    "required": ["id", "name", "email"]
                                }
                            }
                        }
                    },
                    "400": {
                        "description": "Bad request",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "errors": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "field": {
                                                        "type": "string"
                                                    },
                                                    "message": {
                                                        "type": "string"
                                                    }
                                                },
                                                "required": ["field", "message"]
                                            }
                                        }
                                    },
                                    "required": ["errors"]
                                }
                            }
                        }
                    },
                    "500": {
                        "description": "Internal server error",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "error": {
                                            "type": "string"
                                        }
                                    },
                                    "required": ["error"]
                                }
                            }
                        }
                    }
                },
                "operationId": "getUsersById",
                "description": "Get a user by ID",
                "parameters": [
                    {
                        "schema": {
                            "type": "string"
                        },
                        "in": "path",
                        "name": "id",
                        "required": true
                    }
                ],
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object"
                            }
                        }
                    }
                }
            }
        }
    }
}
```
