// Semantics of REQUIRES and ALTERNATIVE relationships as enforced by WildFly.
// Shared by the server instructions, find_relationships and run_cypher so the
// rule reaches the agent no matter which path it uses to discover relations.

export const RELATIONSHIP_SEMANTICS =
  "ALTERNATIVE means mutually exclusive by definition, not by value: WildFly checks whether an attribute/parameter is defined. " +
  'Writing false (or any other value) still defines it and fails with WFLYCTL0105 ("X is invalid in combination with Y"). ' +
  "To switch from one alternative to another, undefine-attribute the old one(s) first (e.g. in the same batch), then write the new one. " +
  "REQUIRES means the required attribute/parameter must be defined first, or in the same batch/operation.";

const RELATIONSHIP_PATTERN = /\b(ALTERNATIVE|REQUIRES)\b/;

/** Whether a Cypher query or a result value refers to REQUIRES/ALTERNATIVE relationships. */
export function mentionsRelationships(text: string): boolean {
  return RELATIONSHIP_PATTERN.test(text);
}
