import { describe, it } from "node:test";
import { assertQueryLineConformance } from "@plurnk/plurnk-mimetypes/conformance";
import Handler from "./TextProtobuf.ts";

// #41: structural matches carry source-line spans (coverage gate).
const h = new Handler({"mimetype":"application/protobuf","glyph":"🔧","extensions":[".proto"]});

describe("#41 query-line conformance", () => {
    it("every structural match carries a source-line span", async () => {
        await assertQueryLineConformance(h, [{ source: "message M { int32 a = 1; }\n", dialect: "jsonpath", pattern: "$..*" }]);
    });
});
