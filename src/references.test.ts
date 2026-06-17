import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertHandlerConformance } from "@plurnk/plurnk-mimetypes/conformance";
import TextProtobuf from "./TextProtobuf.ts";

const metadata = { mimetype: "application/protobuf", glyph: "🔧", extensions: [".proto"] };
const h = () => new TextProtobuf(metadata);

const SRC = `syntax = "proto3";
package myapp;

// TODO frobnicate the widget
message Address {
  string street = 1;
  string city = 2;
}

enum Status {
  UNKNOWN = 0;
  ACTIVE = 1;
}

message User {
  string name = 1;
  Address address = 2;
  Status status = 3;
  repeated Address previous = 4;
  map<string, Address> tags = 5;
}

message GetUserRequest {
  string id = 1;
}

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
}
`;

describe("TextProtobuf — references (type graph)", () => {
    it("non-scalar field types are type edges to their message/enum, scoped to the message", () => {
        const refs = h().references(SRC);
        assert.ok(refs.some((r) => r.name === "Address" && r.kind === "type" && r.container === "User"));
        assert.ok(refs.some((r) => r.name === "Status" && r.kind === "type" && r.container === "User"));
        // map<string, Address> — the value type, not the scalar key.
        assert.equal(refs.filter((r) => r.name === "Address").length, 3, "address + previous + map value");
    });

    it("scalar field types (string) emit no ref", () => {
        const refs = h().references(SRC);
        assert.ok(!refs.some((r) => r.name === "string"));
    });

    it("rpc request/response are type edges from the service", () => {
        const refs = h().references(SRC);
        assert.ok(refs.some((r) => r.name === "GetUserRequest" && r.kind === "type" && r.container === "UserService"));
        assert.ok(refs.some((r) => r.name === "User" && r.kind === "type" && r.container === "UserService"));
    });

    it("passes the SPEC §16 conformance invariants", async () => {
        await assertHandlerConformance(h(), {
            source: SRC,
            decoyNames: ["frobnicate", "widget", "TODO", "street", "proto3"],
            expectJoins: [
                { refName: "Address", container: "User" },
                { refName: "Status", container: "User" },
                { refName: "GetUserRequest", container: "UserService" },
            ],
            expectRefs: [
                { name: "Address", kind: "type" },
                { name: "Status", kind: "type" },
                { name: "User", kind: "type" },
            ],
        });
    });
});
