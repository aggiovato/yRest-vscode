// Example: yrest tagged template in TypeScript test setup.
//
// The yrest tagged template and `createYrestServer` are part of the
// planned programmatic API for @aggiovato/yrest. The DSL and inline
// content support will be available once the monorepo migration
// (packages/core + packages/server) is complete.
//
// This file exists to demonstrate grammar highlighting for the yrest``
// tagged template — it is not meant to be executed as-is.

declare function yrest(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string;
declare function createYrestServer(opts: {
  content: string;
  port: number;
}): Promise<{ start(): Promise<void>; stop(): Promise<void> }>;

const fixture = yrest`
  _rel:
    posts:
      userId: "m2o:users[1..1->0..n]+nested"
    comments:
      postId: "m2o:posts[1..1->0..n]+nested"
      userId: "m2o:users[1..1->0..n]"

  users:
    - id: 1
      name: Ana García
      role: admin
    - id: 2
      name: Luis Pérez
      role: editor

  posts:
    - id: 1
      userId: 1
      title: Hello yrest
      published: true

  comments:
    - id: 1
      postId: 1
      userId: 2
      body: Nice post!
`;

const authFixture = yrest`
  _rel:
    users:
      roles: "m2m:roles@user_roles(userId,roleId)[0..n->0..n]"

  _routes:
    - method: POST
      path: /auth/login
      scenarios:
        - when:
            body.email: admin@test.com
          response:
            status: 200
            body:
              token: "{{uuid}}"
              role: admin
      otherwise:
        status: 401
        body: { error: Unauthorized }

    - method: GET
      path: /users/:id/profile
      response:
        status: 200
        body:
          userId: "{{params.id}}"
          fetchedAt: "{{now}}"

  users:
    - id: 1
      email: admin@test.com
      name: Admin

  roles:
    - id: 1
      label: admin
    - id: 2
      label: viewer

  user_roles:
    - id: 1
      userId: 1
      roleId: 1
`;

async function startTestServer() {
  const server = await createYrestServer({ content: fixture, port: 3099 });
  await server.start();
  return server;
}

export { startTestServer, fixture, authFixture };
