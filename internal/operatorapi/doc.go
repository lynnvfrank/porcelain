// Package operatorapi defines JSON shapes for Chimera operator HTTP APIs
// (primarily /api/ui/* consumed by the logs shell and future clients such as Locus CLI).
//
// # Breaking-change policy
//
// Field names and JSON types on exported structs are the wire contract. Treat any rename,
// type change, or removal as a breaking API change: bump the documented operator API
// version, update embed UI clients in the same change, and note the migration in release notes.
// Adding optional fields with omitempty is backward compatible when clients ignore unknown keys.
package operatorapi
