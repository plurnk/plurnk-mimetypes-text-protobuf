import { AntlrExtractor, withExtractor } from "@plurnk/plurnk-mimetypes";
import type { ExtractionVisitor } from "@plurnk/plurnk-mimetypes";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { Protobuf3Lexer } from "./generated/Protobuf3Lexer.ts";
import { Protobuf3Parser } from "./generated/Protobuf3Parser.ts";
import { Protobuf3Visitor } from "./generated/Protobuf3Visitor.ts";

// application/x-protobuf handler. ANTLR grammar from grammars-v4/protobuf/protobuf3.
//
// Parser entry rule: proto.
export default class TextProtobuf extends AntlrExtractor {
    protected parseTree(content: string): unknown {
        const lexer = new Protobuf3Lexer(CharStream.fromString(content));
        const tokens = new CommonTokenStream(lexer);
        const parser = new Protobuf3Parser(tokens);
        parser.removeErrorListeners();
        return parser.proto();
    }

    protected createVisitor(): ExtractionVisitor {
        return new TextProtobufVisitor() as unknown as ExtractionVisitor;
    }
}

// SPEC §3 mapping for Protobuf v3:
//   packageStatement      → module (the package namespace)
//   messageDef            → class; each field/oneofField/mapField → field
//   enumDef               → enum
//   serviceDef            → interface (an RPC service IS an interface)
//   rpc                   → method
//   extendDef             → not surfaced (extension declarations)
//   importStatement       → excluded
//   optionStatement       → excluded
class TextProtobufVisitor extends withExtractor(Protobuf3Visitor) {
    visitPackageStatement = (ctx: any): null => {
        if (this.inBody) return null;
        const fid = ctx.fullIdent?.();
        const name = identText(fid);
        if (name) this.addSymbol("module", name, ctx);
        return null;
    };

    visitMessageDef = (ctx: any): null => {
        if (this.inBody) return null;
        const mn = ctx.messageName?.();
        const name = identText(mn);
        if (!name) return null;
        this.addSymbol("class", name, ctx);
        this.visitChildren(ctx);
        return null;
    };

    visitEnumDef = (ctx: any): null => {
        if (this.inBody) return null;
        const en = ctx.enumName?.();
        const name = identText(en);
        if (name) this.addSymbol("enum", name, ctx);
        return null;
    };

    visitServiceDef = (ctx: any): null => {
        if (this.inBody) return null;
        const sn = ctx.serviceName?.();
        const name = identText(sn);
        if (!name) return null;
        this.addSymbol("interface", name, ctx);
        this.visitChildren(ctx);
        return null;
    };

    visitRpc = (ctx: any): null => {
        if (this.inBody) return null;
        const rn = ctx.rpcName?.();
        const name = identText(rn);
        if (!name) return null;
        // rpc: RPC rpcName LP (STREAM)? messageType RP RETURNS LP (STREAM)? messageType RP
        const mts = collectChildren(ctx, "messageType");
        const params: string[] = [];
        if (mts[0]) {
            const t = (mts[0] as { getText?: () => string }).getText?.();
            if (t) params.push(t);
        }
        this.addSymbol("method", name, ctx, params);
        return null;
    };

    visitField = (ctx: any): null => {
        if (this.inBody) return null;
        const fn = ctx.fieldName?.();
        const name = identText(fn);
        if (name) this.addSymbol("field", name, ctx);
        return null;
    };

    visitOneofField = (ctx: any): null => {
        if (this.inBody) return null;
        const fn = ctx.fieldName?.();
        const name = identText(fn);
        if (name) this.addSymbol("field", name, ctx);
        return null;
    };

    visitMapField = (ctx: any): null => {
        if (this.inBody) return null;
        const mn = ctx.mapName?.();
        const name = identText(mn);
        if (name) this.addSymbol("field", name, ctx);
        return null;
    };
}

function identText(ctx: unknown): string | null {
    if (!ctx) return null;
    return (ctx as { getText?: () => string }).getText?.() ?? null;
}

function collectChildren(ctx: unknown, methodName: string): unknown[] {
    const node = ctx as Record<string, unknown>;
    const accessor = node[methodName] as ((...args: unknown[]) => unknown) | undefined;
    if (typeof accessor !== "function") return [];
    const raw = accessor.call(node);
    if (Array.isArray(raw)) return raw;
    return raw ? [raw] : [];
}
