# Example Cypher Queries

These examples show common query patterns for the WildFly management model graph. Use them as templates when the structured tools (`search_resources`, `browse_resource`, etc.) are insufficient and `run_cypher` is needed.

## Relationship exploration

Show the alternatives and requires relations of the connection-definitions resources:

```cypher
MATCH g=(r:Resource)-->(:Attribute)-[:ALTERNATIVE|REQUIRES]->(:Attribute)
WHERE r.name = "connection-definitions"
RETURN g
```

## Aggregation queries

Show the top twenty resources with the most attributes:

```cypher
MATCH (r:Resource)-[has:HAS_ATTRIBUTE]->()
RETURN r.address, COUNT(has) as attributes
ORDER BY attributes DESC
LIMIT 20
```

List all resources with more than five non-global operations:

```cypher
MATCH (r:Resource)-[p:PROVIDES]->(o:Operation)
WHERE NOT o.global
WITH r, count(p) as operations
WHERE operations > 5
RETURN r.address, operations
ORDER BY operations DESC
```

## Filtered attribute queries

List all attributes which are required and have a default value:

```cypher
MATCH (r:Resource)-->(a:Attribute)
WHERE a.required = true AND
      a.default IS NOT NULL
RETURN r.address, a.name, a.default
```

## Operation parameter analysis

List all add operations with more than two required parameters:

```cypher
MATCH (r:Resource)-[:PROVIDES]->(o:Operation)-[a:ACCEPTS]->(p:Parameter)
WHERE o.name = "add" AND p.required
WITH r, o, count(a) as parameters
WHERE parameters > 2
RETURN r.address, o.name, parameters
ORDER BY parameters DESC
```
