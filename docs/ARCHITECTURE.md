# Architecture

Use a TypeScript modular monolith. `src/domain` owns entities and all schedule/status calculations. `src/server` is a thin HTTP boundary. `src/web` renders and calls typed APIs. Storage is replaceable behind a repository interface; the first vertical slice may use an in-memory implementation.

Dependencies point inward: web and server may use domain; domain may not import web, server, or storage. Route handlers and components must not calculate next-due dates or overdue status.
