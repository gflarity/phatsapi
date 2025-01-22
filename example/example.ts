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
    createUserSchema, // json body is the default source
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
