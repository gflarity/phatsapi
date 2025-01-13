![phatsapi](https://github.com/user-attachments/assets/da3d6ad9-bc4a-4d85-a0d6-730f41e0df3b)

# PhatsAPI - Deno API Framework

## Setup

Coming to JSR soon!

## Example

Use Zod Schemas to quickly create an OpenAPI 3.0-compliant REST API in Deno.

```ts
import { PhatsAPI } from './phatsapi.ts';
import { z } from 'npm:zod';
import { extendZodWithOpenApi } from 'npm:zod-openapi';

extendZodWithOpenApi(z);

const api = new PhatsAPI({
  documentation: {
    info: {
      title: 'My API',
      version: '1.0.0',
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local server",
      },
    ],
  },
});

// Define schemas for request and response
const createUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

const updateUserSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().email().optional(),
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
  '/users',
  createUserSchema,
  userSchema,
  'Create a new user',
  async (req) => {
    // Replace this with your actual user creation logic
    const userId = 'user123'; // Generate a unique ID
    const user = {
      id: userId,
      name: req.name,
      email: req.email,
    };
    // Simulate asynchronous operation (e.g., database insertion)
    await new Promise((resolve) => setTimeout(resolve, 100));
    return user;
  },
);

// Create a PUT endpoint to update a user
api.put(
  '/users/:id',
  updateUserSchema,
  userSchema,
  'Update a user',
  async (req) => {
    // Replace this with your actual user update logic
    const updatedUser = {
      id: req.id,
      name: req.name ?? 'John Doe',
      email: req.email ?? 'johndoe@example.com',
    };
    // Simulate asynchronous operation (e.g., database update)
    await new Promise((resolve) => setTimeout(resolve, 100));
    return updatedUser;
  },
);

// Create a GET endpoint to fetch a user by ID
api.get(
  '/users/:id',
  requestSchema,
  userSchema,
  'Get a user by ID',
  async (req) => {
    // Replace this with your actual data fetching logic
    const user: z.infer<typeof userSchema> = {
      id: req.id,
      name: 'John Doe',
      email: 'johndoe@example.com',
    };
    return user;
  },
);

// Start the server
Deno.serve({ hostname: "localhost", port: 3000 }, api.fetch);
```

Now take a look at your schema using `curl http://localhost:3000/openapi

```json
{"openapi":"3.1.0","info":{"title":"My API","description":"Development documentation","version":"1.0.0"},"servers":[{"url":"http://localhost:3000","description":"Local server"}],"paths":{"/users":{"post":{"responses":{"200":{"description":"Successful response","content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"email":{"type":"string","format":"email"}},"required":["id","name","email"]}}}},"400":{"description":"Bad request","content":{"application/json":{"schema":{"type":"object","properties":{"errors":{"type":"array","items":{"type":"object","properties":{"field":{"type":"string"},"message":{"type":"string"}},"required":["field","message"]}}},"required":["errors"]}}}},"500":{"description":"Internal server error","content":{"application/json":{"schema":{"type":"object","properties":{"error":{"type":"string"}},"required":["error"]}}}}},"operationId":"postUsers","description":"Create a new user"}},"/users/{id}":{"put":{"responses":{"200":{"description":"Successful response","content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"email":{"type":"string","format":"email"}},"required":["id","name","email"]}}}},"400":{"description":"Bad request","content":{"application/json":{"schema":{"type":"object","properties":{"errors":{"type":"array","items":{"type":"object","properties":{"field":{"type":"string"},"message":{"type":"string"}},"required":["field","message"]}}},"required":["errors"]}}}},"500":{"description":"Internal server error","content":{"application/json":{"schema":{"type":"object","properties":{"error":{"type":"string"}},"required":["error"]}}}}},"operationId":"putUsersById","description":"Update a user","parameters":[{"schema":{"type":"string"},"in":"path","name":"id","required":true}]},"get":{"responses":{"200":{"description":"Successful response","content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"email":{"type":"string","format":"email"}},"required":["id","name","email"]}}}},"400":{"description":"Bad request","content":{"application/json":{"schema":{"type":"object","properties":{"errors":{"type":"array","items":{"type":"object","properties":{"field":{"type":"string"},"message":{"type":"string"}},"required":["field","message"]}}},"required":["errors"]}}}},"500":{"description":"Internal server error","content":{"application/json":{"schema":{"type":"object","properties":{"error":{"type":"string"}},"required":["error"]}}}}},"operationId":"getUsersById","description":"Get a user by ID","parameters":[{"schema":{"type":"string"},"in":"path","name":"id","required":true}]}}},"components":{"schemas":{}}
```

