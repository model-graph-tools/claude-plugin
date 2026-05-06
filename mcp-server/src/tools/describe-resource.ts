// Generates a concise markdown summary of a resource: purpose, add-operation parameters,
// required/optional attributes with constraints, and a CLI example.

import { getSessions } from "../neo4j.js";

// --- Types ---

interface ParameterRow {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface AttributeRow {
  name: string;
  type: string;
  description: string;
  defaultValue: string | null;
  allowed: string[] | null;
  unit: string | null;
  restartRequired: string | null;
}

// --- Main ---

export async function describeResource(
  identifier: string,
  address: string
): Promise<string> {
  const sessions = await getSessions(identifier, 3);
  try {
    const [resourceResult, requiredAttrsResult, optionalAttrsResult] =
      await Promise.all([
        sessions[0].run(
          `MATCH (r:Resource {address: $address})
           OPTIONAL MATCH (r)-[:PROVIDES]->(o:Operation {name: "add"})-[:ACCEPTS]->(p:Parameter)
           RETURN r.name AS resourceName, r.description AS resourceDescription,
                  p.name AS paramName, p.type AS paramType,
                  p.required AS paramRequired, p.description AS paramDescription
           ORDER BY p.required DESC, p.name`,
          { address }
        ),
        sessions[1].run(
          `MATCH (r:Resource {address: $address})-[:HAS_ATTRIBUTE]->(a:Attribute)
           WHERE a.required = true
           RETURN a.name AS name, a.type AS type,
                  a.description AS description, a.\`default-value\` AS defaultValue,
                  a.allowed AS allowed, a.unit AS unit,
                  a.\`restart-required\` AS restartRequired
           ORDER BY a.name`,
          { address }
        ),
        sessions[2].run(
          `MATCH (r:Resource {address: $address})-[:HAS_ATTRIBUTE]->(a:Attribute)
           WHERE (a.required IS NULL OR a.required = false)
             AND NOT EXISTS { (a)-[:DEPRECATED_SINCE]->() }
           RETURN a.name AS name, a.type AS type,
                  a.description AS description, a.\`default-value\` AS defaultValue,
                  a.allowed AS allowed, a.unit AS unit,
                  a.\`restart-required\` AS restartRequired
           ORDER BY a.name`,
          { address }
        ),
      ]);

    if (resourceResult.records.length === 0) {
      throw new Error(
        `Resource not found: ${address}. Use search_resources to find valid addresses.`
      );
    }

    const resourceName = resourceResult.records[0].get("resourceName") as string;
    const resourceDescription =
      (resourceResult.records[0].get("resourceDescription") as string | null) ?? "";

    const addParams: ParameterRow[] = resourceResult.records
      .filter((r) => r.get("paramName") != null)
      .map((r) => ({
        name: r.get("paramName") as string,
        type: r.get("paramType") as string,
        required: (r.get("paramRequired") as boolean) ?? false,
        description: r.get("paramDescription") as string,
      }));

    const requiredAttrs: AttributeRow[] = requiredAttrsResult.records.map((r) => ({
      name: r.get("name") as string,
      type: r.get("type") as string,
      description: r.get("description") as string,
      defaultValue: r.get("defaultValue") as string | null,
      allowed: r.get("allowed") as string[] | null,
      unit: r.get("unit") as string | null,
      restartRequired: r.get("restartRequired") as string | null,
    }));

    const optionalAttrs: AttributeRow[] = optionalAttrsResult.records.map((r) => ({
      name: r.get("name") as string,
      type: r.get("type") as string,
      description: r.get("description") as string,
      defaultValue: r.get("defaultValue") as string | null,
      allowed: r.get("allowed") as string[] | null,
      unit: r.get("unit") as string | null,
      restartRequired: r.get("restartRequired") as string | null,
    }));

    return formatMarkdown(
      resourceName,
      resourceDescription,
      address,
      addParams,
      requiredAttrs,
      optionalAttrs
    );
  } finally {
    await Promise.all(sessions.map((s) => s.close()));
  }
}

// --- Markdown formatting ---

function formatMarkdown(
  name: string,
  description: string,
  address: string,
  addParams: ParameterRow[],
  requiredAttrs: AttributeRow[],
  optionalAttrs: AttributeRow[]
): string {
  const lines: string[] = [];

  lines.push(`## ${name}`);
  lines.push("");
  if (description) {
    lines.push(description);
    lines.push("");
  }
  lines.push(`**Address:** \`${address}\``);
  lines.push("");

  const requiredParams = addParams.filter((p) => p.required);
  const optionalParams = addParams.filter((p) => !p.required);

  if (requiredParams.length > 0) {
    lines.push("### Required parameters (add operation)");
    lines.push("");
    lines.push(...formatParamTable(requiredParams));
    lines.push("");
  }

  if (optionalParams.length > 0) {
    lines.push("### Optional parameters (add operation)");
    lines.push("");
    lines.push(...formatParamTable(optionalParams));
    lines.push("");
  }

  if (addParams.length === 0) {
    lines.push("*No add operation found for this resource.*");
    lines.push("");
  }

  if (requiredAttrs.length > 0) {
    lines.push("### Required attributes");
    lines.push("");
    lines.push(...formatAttrTable(requiredAttrs));
    lines.push("");
  }

  if (optionalAttrs.length > 0) {
    lines.push(`### Optional attributes (${optionalAttrs.length} total)`);
    lines.push("");
    lines.push(...formatAttrTable(optionalAttrs));
    lines.push("");
  }

  if (requiredParams.length > 0) {
    lines.push("### CLI example");
    lines.push("");
    const exampleName = extractExampleName(name);
    const exampleParams = requiredParams
      .map((p) => `${p.name}=${placeholderFor(p.type)}`)
      .join(", ");
    lines.push("```");
    lines.push(`${address.replace("=*", `=${exampleName}`)}:add(${exampleParams})`);
    lines.push("```");
  }

  return lines.join("\n");
}

function formatParamTable(params: ParameterRow[]): string[] {
  const lines: string[] = [];
  lines.push("| Parameter | Type | Description |");
  lines.push("|-----------|------|-------------|");
  for (const p of params) {
    lines.push(`| ${p.name} | ${p.type} | ${truncate(p.description)} |`);
  }
  return lines;
}

function formatAttrTable(attrs: AttributeRow[]): string[] {
  const lines: string[] = [];
  lines.push("| Attribute | Type | Default | Constraints | Description |");
  lines.push("|-----------|------|---------|-------------|-------------|");
  for (const a of attrs) {
    const def = a.defaultValue ?? "-";
    const constraints = formatConstraints(a);
    lines.push(`| ${a.name} | ${a.type} | ${def} | ${constraints} | ${truncate(a.description)} |`);
  }
  return lines;
}

function formatConstraints(attr: AttributeRow): string {
  const parts: string[] = [];
  if (attr.allowed != null && attr.allowed.length > 0) {
    parts.push(attr.allowed.join(", "));
  }
  if (attr.unit != null) {
    parts.push(attr.unit);
  }
  if (attr.restartRequired != null) {
    parts.push(`restart: ${attr.restartRequired}`);
  }
  return parts.length > 0 ? parts.join("; ") : "-";
}

function truncate(text: string, maxLength = 120): string {
  if (!text) return "-";
  const cleaned = text.replace(/\|/g, "/").replace(/\n/g, " ");
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength - 3) + "...";
}

function extractExampleName(name: string): string {
  const parts = name.split("-");
  if (parts.length > 1) {
    return "My" + parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  }
  return "My" + name.charAt(0).toUpperCase() + name.slice(1);
}

function placeholderFor(type: string): string {
  switch (type?.toUpperCase()) {
    case "STRING":
      return '"..."';
    case "INT":
    case "LONG":
      return "0";
    case "BOOLEAN":
      return "true";
    default:
      return '"..."';
  }
}
