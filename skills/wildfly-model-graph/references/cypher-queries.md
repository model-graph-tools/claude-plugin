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
      a.`default-value` IS NOT NULL
RETURN r.address, a.name, a.`default-value`
```

## Capability queries

Find all resources that declare a capability matching a pattern:

```cypher
MATCH (r:Resource)-[:DECLARES_CAPABILITY]->(c:Capability)
WHERE c.name CONTAINS "data-source"
RETURN r.address, c.name
ORDER BY c.name
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

Get the add operation parameters for a specific resource (useful for "how do I add X?" questions):

```cypher
MATCH (r:Resource {address: "/subsystem=datasources/data-source=*"})-[:PROVIDES]->(o:Operation {name: "add"})-[:ACCEPTS]->(p:Parameter)
RETURN p.name AS name, p.type AS type, p.required AS required, p.description AS description
ORDER BY p.required DESC, p.name
```

## Deprecation queries

Find all elements deprecated since a specific management model version with reasons:

```cypher
MATCH (n)-[:DEPRECATED_SINCE]->(v:Version)
WHERE v.ordinal >= 300
RETURN labels(n)[0] AS type, n.name AS name, v.ordinal AS since, n.`deprecated-reason` AS reason
ORDER BY v.ordinal DESC, type, name
LIMIT 50
```

Get required attributes for a specific resource:

```cypher
MATCH (r:Resource {address: "/subsystem=datasources/data-source=*"})-[:HAS_ATTRIBUTE]->(a:Attribute)
WHERE a.required = true
RETURN a.name AS name, a.type AS type, a.description AS description, a.`default-value` AS defaultValue
ORDER BY a.name
```

## Sensitivity queries

Find all security-sensitive attributes:

```cypher
MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)-[:IS_SENSITIVE]->(c:Constraint)
RETURN r.address AS resource, a.name AS attribute, a.type AS type,
       c.name AS constraint, c.type AS constraintType
ORDER BY r.address, a.name
```

Find sensitive attributes matching a keyword (e.g., passwords):

```cypher
MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)-[:IS_SENSITIVE]->(c:Constraint)
WHERE a.name =~ '(?i).*password.*'
RETURN r.address AS resource, a.name AS attribute, c.name AS constraint
ORDER BY r.address
```

## Restart-required queries

Find all attributes that require a JVM restart:

```cypher
MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
WHERE a.`restart-required` = 'jvm'
RETURN r.address AS resource, a.name AS attribute, a.type AS type
ORDER BY r.address, a.name
```

Find restart-required attributes in a specific subsystem:

```cypher
MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
WHERE a.`restart-required` IS NOT NULL
  AND r.address =~ '(?i).*undertow.*'
RETURN r.address AS resource, a.name AS attribute,
       a.`restart-required` AS restartLevel
ORDER BY a.`restart-required`, r.address
```

## Allowed values queries

Find attributes with enumerated allowed values:

```cypher
MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
WHERE a.allowed IS NOT NULL
RETURN r.address AS resource, a.name AS attribute, a.allowed AS allowedValues
ORDER BY r.address, a.name
LIMIT 25
```

Find attributes or parameters with numeric range constraints:

```cypher
MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
WHERE a.min IS NOT NULL OR a.max IS NOT NULL
RETURN r.address AS resource, a.name AS attribute,
       a.min AS min, a.max AS max, a.unit AS unit
ORDER BY r.address, a.name
```

## Attribute group queries

List all attribute groups and their member attributes for a resource:

```cypher
MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
WHERE r.address = '/subsystem=undertow/server=*/http-listener=*'
  AND a.`attribute-group` IS NOT NULL
RETURN a.`attribute-group` AS groupName, collect(a.name) AS attributes
ORDER BY groupName
```

Find all resources that use a specific attribute group name:

```cypher
MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
WHERE a.`attribute-group` =~ '(?i).*connection.*'
RETURN DISTINCT r.address AS resource, a.`attribute-group` AS groupName
ORDER BY r.address
```
