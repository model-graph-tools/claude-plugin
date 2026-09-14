import { z } from "zod";

// --- Lifecycle tools ---

export const listSourcesOutput = z.object({
  activeSource: z.string().nullable(),
  sources: z.array(z.object({
    identifier: z.string(),
    type: z.enum(["wildfly", "feature-pack"]),
    name: z.string(),
    version: z.string(),
    status: z.enum(["running", "not_found"]),
    active: z.boolean(),
    bolt: z.number().optional(),
    http: z.number().optional(),
  })),
});

export const startSourceOutput = z.object({
  identifier: z.string(),
  status: z.literal("running"),
  bolt: z.number(),
  http: z.number(),
  message: z.string(),
});

export const stopSourceOutput = z.object({
  identifier: z.string(),
  status: z.literal("stopped"),
});

// --- Search tools (results + totalCount pattern) ---

export const searchResourcesOutput = z.object({
  results: z.array(z.object({
    address: z.string(),
    name: z.string(),
    description: z.string(),
    singleton: z.boolean(),
    childCount: z.number(),
  })),
  totalCount: z.number(),
});

export const searchOperationsOutput = z.object({
  results: z.array(z.object({
    resource: z.string(),
    operation: z.string(),
    description: z.string(),
    stability: z.string().optional(),
    global: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    runtimeOnly: z.boolean().optional(),
    returnValue: z.string().optional(),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean(),
    })),
    deprecatedSince: z.string().optional(),
    deprecationReason: z.string().optional(),
  })),
  totalCount: z.number(),
});

export const searchAttributesOutput = z.object({
  results: z.array(z.object({
    resource: z.string(),
    name: z.string(),
    type: z.string(),
    description: z.string(),
    accessType: z.string().optional(),
    required: z.boolean().optional(),
    deprecatedSince: z.string().optional(),
    deprecationReason: z.string().optional(),
  })),
  totalCount: z.number(),
});

// --- Find tools ---

export const findCapabilitiesOutput = z.object({
  results: z.array(z.object({
    capability: z.string(),
    declaredBy: z.array(z.string()),
    referencedBy: z.array(z.object({
      attribute: z.string(),
      resource: z.string(),
    })),
    referencedByParameters: z.array(z.object({
      parameter: z.string(),
      operation: z.string(),
      resource: z.string(),
    })),
  })),
});

export const findDeprecatedOutput = z.object({
  results: z.array(z.object({
    elementType: z.string(),
    name: z.string(),
    resource: z.string().optional(),
    deprecatedSince: z.string(),
    reason: z.string().optional(),
  })),
  totalCount: z.number(),
});

export const findByStabilityOutput = z.object({
  results: z.array(z.object({
    elementType: z.string(),
    name: z.string(),
    resource: z.string().optional(),
    stability: z.string(),
  })),
  totalCount: z.number(),
});

export const findSensitiveAttributesOutput = z.object({
  results: z.array(z.object({
    resource: z.string(),
    attribute: z.string(),
    type: z.string(),
    constraint: z.string(),
    constraintType: z.string(),
  })),
  totalCount: z.number(),
});

export const findRestartRequiredOutput = z.object({
  results: z.array(z.object({
    resource: z.string(),
    attribute: z.string(),
    type: z.string(),
    restartRequired: z.string(),
    defaultValue: z.string().optional(),
  })),
  totalCount: z.number(),
});

export const findAttributeGroupsOutput = z.object({
  results: z.array(z.object({
    resource: z.string(),
    group: z.string(),
    attributes: z.array(z.string()),
  })),
});

export const getAllowedValuesOutput = z.object({
  results: z.array(z.object({
    elementType: z.enum(["attribute", "parameter"]),
    name: z.string(),
    resource: z.string(),
    operation: z.string().optional(),
    type: z.string(),
    allowed: z.array(z.string()).optional(),
    defaultValue: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    unit: z.string().optional(),
  })),
  totalCount: z.number(),
});

// --- Statistics ---

const stabilityBreakdown = z.object({
  default: z.number(),
  community: z.number(),
  preview: z.number(),
  experimental: z.number(),
});

export const getStatisticsOutput = z.object({
  identity: z.object({
    name: z.string(),
    identifier: z.string(),
    type: z.string(),
    version: z.string(),
    description: z.string(),
    groupId: z.string().optional(),
    artifactId: z.string().optional(),
    url: z.string().optional(),
    scmUrl: z.string().optional(),
    licenses: z.string().optional(),
  }).optional(),
  resources: z.number(),
  attributes: z.number(),
  operations: z.number(),
  parameters: z.number(),
  capabilities: z.number(),
  deprecated: z.object({
    resources: z.number(),
    attributes: z.number(),
    operations: z.number(),
  }),
  stability: z.object({
    resources: stabilityBreakdown,
    attributes: stabilityBreakdown,
    operations: stabilityBreakdown,
    parameters: stabilityBreakdown,
  }),
  relationships: z.object({
    childOf: z.number(),
    hasAttribute: z.number(),
    provides: z.number(),
    accepts: z.number(),
    declaresCapability: z.number(),
    referencesCapability: z.number(),
    requires: z.number(),
    alternative: z.number(),
    isSensitive: z.number(),
    consistsOf: z.number(),
    deprecatedSince: z.number(),
  }),
});
