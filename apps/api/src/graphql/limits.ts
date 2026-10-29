import {
  GraphQLError,
  Kind,
  type ASTVisitor,
  type SelectionSetNode,
  type ValidationContext,
} from 'graphql';

// Cheap protection against expensive queries, as GraphQL validation rules: they run once per
// operation before any resolver, and are cached with the parsed document by Apollo.

/** Refuses selection sets nested deeper than `max` (fragments are followed). */
export function maxDepthRule(max: number) {
  return (context: ValidationContext): ASTVisitor => {
    const fragments = new Map(
      context
        .getDocument()
        .definitions.filter((d) => d.kind === Kind.FRAGMENT_DEFINITION)
        .map((d) => [d.name.value, d.selectionSet]),
    );

    const depthOf = (set: SelectionSetNode, seen: ReadonlySet<string>): number => {
      let deepest = 0;
      for (const selection of set.selections) {
        if (selection.kind === Kind.FIELD) {
          const child = selection.selectionSet ? depthOf(selection.selectionSet, seen) : 0;
          deepest = Math.max(deepest, 1 + child);
        } else if (selection.kind === Kind.INLINE_FRAGMENT) {
          deepest = Math.max(deepest, depthOf(selection.selectionSet, seen));
        } else {
          const name = selection.name.value;
          const fragment = fragments.get(name);
          // A fragment cycle is reported by GraphQL's own NoFragmentCycles rule.
          if (fragment && !seen.has(name)) {
            deepest = Math.max(deepest, depthOf(fragment, new Set([...seen, name])));
          }
        }
      }
      return deepest;
    };

    return {
      OperationDefinition(node) {
        const depth = depthOf(node.selectionSet, new Set());
        if (depth > max) {
          context.reportError(
            new GraphQLError(`Query depth ${String(depth)} exceeds the limit of ${String(max)}.`, {
              nodes: [node],
            }),
          );
        }
      },
    };
  };
}

/** Refuses operations with more than `max` aliased fields (alias-based batching attacks). */
export function maxAliasesRule(max: number) {
  return (context: ValidationContext): ASTVisitor => {
    let count = 0;
    return {
      Field(node) {
        if (node.alias) count += 1;
      },
      Document: {
        leave() {
          if (count > max) {
            context.reportError(
              new GraphQLError(`${String(count)} aliases exceed the limit of ${String(max)}.`),
            );
          }
        },
      },
    };
  };
}
