// Converted from `enum` to a const-object so Node's strip-only TS mode
// (used by `node --test`) can load it without a transform step.
export const TypeClassification = Object.freeze({
    Message_: 0,
    Block_: 1,
    Enum_: 2,
    Service_: 3,
    Package_: 4,
});
export type TypeClassification = typeof TypeClassification[keyof typeof TypeClassification];
