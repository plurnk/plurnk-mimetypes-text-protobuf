import { describe, it } from "node:test";
import assert from "node:assert/strict";
import TextProtobuf from "./TextProtobuf.ts";

const metadata = {
    mimetype: "application/protobuf",
    glyph: "🔧",
    extensions: [".proto"] as const,
};

describe("TextProtobuf — instantiation", () => {
    it("instantiates with metadata", () => {
        const h = new TextProtobuf(metadata);
        assert.equal(h.mimetype, "application/protobuf");
        assert.equal(h.glyph, "🔧");
    });
});

describe("TextProtobuf — extract", () => {
    it("extracts package, message + fields, enum", () => {
        const h = new TextProtobuf(metadata);
        const src = [
            "syntax = \"proto3\";",
            "package example.v1;",
            "",
            "message User {",
            "    int64 id = 1;",
            "    string email = 2;",
            "    string name = 3;",
            "}",
            "",
            "enum Role {",
            "    ROLE_UNSPECIFIED = 0;",
            "    ROLE_ADMIN = 1;",
            "    ROLE_USER = 2;",
            "}",
        ].join("\n");
        const syms = h.extractRaw(src);

        const pkg = syms.find((s) => s.name === "example.v1" && s.kind === "module");
        assert.ok(pkg);
        const user = syms.find((s) => s.name === "User" && s.kind === "class");
        assert.ok(user);
        assert.ok(syms.find((s) => s.name === "id" && s.kind === "field"));
        assert.ok(syms.find((s) => s.name === "email" && s.kind === "field"));
        assert.ok(syms.find((s) => s.name === "name" && s.kind === "field"));
        const role = syms.find((s) => s.name === "Role");
        assert.ok(role);
        assert.equal(role.kind, "enum");
    });

    it("extracts service definitions as interface + rpcs as methods", () => {
        const h = new TextProtobuf(metadata);
        const src = [
            "syntax = \"proto3\";",
            "package api;",
            "",
            "message GetUserRequest { int64 id = 1; }",
            "message User { int64 id = 1; string name = 2; }",
            "",
            "service UserService {",
            "    rpc GetUser(GetUserRequest) returns (User);",
            "    rpc StreamUsers(GetUserRequest) returns (stream User);",
            "}",
        ].join("\n");
        const syms = h.extractRaw(src);

        const svc = syms.find((s) => s.name === "UserService");
        assert.ok(svc);
        assert.equal(svc.kind, "interface");

        const get = syms.find((s) => s.name === "GetUser");
        assert.ok(get);
        assert.equal(get.kind, "method");

        const stream = syms.find((s) => s.name === "StreamUsers");
        assert.ok(stream);
    });

    it("extracts oneof fields", () => {
        const h = new TextProtobuf(metadata);
        const src = [
            "syntax = \"proto3\";",
            "message Pet {",
            "    string name = 1;",
            "    oneof species {",
            "        string dog_breed = 2;",
            "        string cat_breed = 3;",
            "    }",
            "}",
        ].join("\n");
        const syms = h.extractRaw(src);
        assert.ok(syms.find((s) => s.name === "name"));
        assert.ok(syms.find((s) => s.name === "dog_breed"));
        assert.ok(syms.find((s) => s.name === "cat_breed"));
    });

    it("extracts map fields", () => {
        const h = new TextProtobuf(metadata);
        const src = [
            "syntax = \"proto3\";",
            "message Config {",
            "    map<string, string> properties = 1;",
            "}",
        ].join("\n");
        const syms = h.extractRaw(src);
        assert.ok(syms.find((s) => s.name === "properties"));
    });

    it("excludes import statements", () => {
        const h = new TextProtobuf(metadata);
        const src = [
            "syntax = \"proto3\";",
            "import \"google/protobuf/timestamp.proto\";",
            "import \"common/types.proto\";",
            "",
            "message Event { string name = 1; }",
        ].join("\n");
        const syms = h.extractRaw(src);
        const names = syms.map((s) => s.name);
        assert.ok(!names.includes("google/protobuf/timestamp.proto"));
        assert.ok(names.includes("Event"));
    });

    it("returns empty array for empty input", () => {
        const h = new TextProtobuf(metadata);
        assert.deepEqual(h.extractRaw(""), []);
    });

    it("does not throw on malformed source", () => {
        const h = new TextProtobuf(metadata);
        assert.doesNotThrow(() => h.extractRaw("syntax = \"proto3\"; message { broken"));
        assert.doesNotThrow(() => h.extractRaw("@@ bogus"));
    });
});

describe("TextProtobuf — framework integration", () => {
    it("renders extracted hierarchy via format()", async () => {
        const h = new TextProtobuf(metadata);
        const out = await h.symbolsRaw("syntax = \"proto3\"; message Answer { int32 id = 1; }");
        assert.ok(out.includes("class Answer"));
        assert.ok(out.includes("field id"));
    });

    it("jsonpath dispatches against the deep-json ANTLR parse tree (issue #10)", async () => {
        // Every ANTLR deep tree has a root with a `type` field — verify
        // jsonpath reaches it via the deep-channel dispatch.
        const h = new TextProtobuf(metadata);
        const roots = await h.query("class Probe {}", "jsonpath", "$.type");
        assert.equal(roots.length, 1);
        assert.equal(typeof roots[0].matched, "string");
    });
});

// Real-world smoke against a representative gRPC-style proto.
describe("TextProtobuf — real-world smoke (gRPC user service)", () => {
    const SRC = [
        "syntax = \"proto3\";",
        "",
        "package plurnk.users.v1;",
        "",
        "import \"google/protobuf/timestamp.proto\";",
        "",
        "message User {",
        "    int64 id = 1;",
        "    string email = 2;",
        "    string name = 3;",
        "    Role role = 4;",
        "    google.protobuf.Timestamp created_at = 5;",
        "}",
        "",
        "enum Role {",
        "    ROLE_UNSPECIFIED = 0;",
        "    ROLE_ADMIN = 1;",
        "    ROLE_USER = 2;",
        "    ROLE_GUEST = 3;",
        "}",
        "",
        "message CreateUserRequest {",
        "    string email = 1;",
        "    string name = 2;",
        "}",
        "",
        "message CreateUserResponse {",
        "    User user = 1;",
        "}",
        "",
        "message GetUserRequest {",
        "    int64 id = 1;",
        "}",
        "",
        "message GetUserResponse {",
        "    User user = 1;",
        "}",
        "",
        "service UserService {",
        "    rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);",
        "    rpc GetUser(GetUserRequest) returns (GetUserResponse);",
        "    rpc StreamUsers(GetUserRequest) returns (stream User);",
        "}",
    ].join("\n");

    it("surfaces package, messages, enums, service, rpcs, and fields", () => {
        const h = new TextProtobuf(metadata);
        const syms = h.extractRaw(SRC);
        const names = new Set(syms.map((s) => s.name));

        assert.ok(names.has("plurnk.users.v1"));
        assert.ok(names.has("User"));
        assert.ok(names.has("Role"));
        assert.ok(names.has("CreateUserRequest"));
        assert.ok(names.has("CreateUserResponse"));
        assert.ok(names.has("GetUserRequest"));
        assert.ok(names.has("GetUserResponse"));
        assert.ok(names.has("UserService"));

        // rpcs
        assert.ok(names.has("CreateUser"));
        assert.ok(names.has("GetUser"));
        assert.ok(names.has("StreamUsers"));

        // selected fields
        assert.ok(names.has("email"));
        assert.ok(names.has("name"));
        assert.ok(names.has("created_at"));
    });

    it("kind discrimination", () => {
        const h = new TextProtobuf(metadata);
        const syms = h.extractRaw(SRC);
        const byNameKind = new Map(syms.map((s) => [`${s.name}:${s.kind}`, s]));
        assert.ok(byNameKind.has("plurnk.users.v1:module"));
        assert.ok(byNameKind.has("User:class"));
        assert.ok(byNameKind.has("Role:enum"));
        assert.ok(byNameKind.has("UserService:interface"));
        assert.ok(byNameKind.has("CreateUser:method"));
        assert.ok(byNameKind.has("email:field"));
    });
});
