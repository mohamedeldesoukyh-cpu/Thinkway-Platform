import type {
  RelationshipEdge,
  RelationshipGraph,
  RelationshipNode,
  ResolvedEntity,
  WorkspaceKnowledge,
} from "../types";
import type { LoadedSnapshots } from "../context-loader/snapshot-loader";

function nodeId(type: string, id: string): string {
  return `${type}:${id}`;
}

function addNode(
  nodes: Map<string, RelationshipNode>,
  type: string,
  id: string,
  label: string,
  metadata?: Record<string, unknown>
): void {
  const key = nodeId(type, id);
  if (!nodes.has(key)) {
    nodes.set(key, { id: key, type, label, metadata });
  }
}

function addEdge(
  edges: RelationshipEdge[],
  from: string,
  to: string,
  relation: string
): void {
  if (from === to) return;
  if (edges.some((e) => e.from === from && e.to === to && e.relation === relation)) return;
  edges.push({ from, to, relation });
}

export function buildRelationshipGraph(
  entities: ResolvedEntity[],
  snapshots: LoadedSnapshots,
  workspace: WorkspaceKnowledge
): RelationshipGraph {
  const nodes = new Map<string, RelationshipNode>();
  const edges: RelationshipEdge[] = [];
  const rootIds: string[] = [];

  const client = snapshots.client ?? workspace.client;
  const brand = snapshots.brand ?? workspace.brand;
  const campaign = snapshots.campaign ?? workspace.campaign;

  if (client) {
    const clientKey = nodeId("client", client.id);
    addNode(nodes, "client", client.id, client.name, { groupId: client.groupId });
    rootIds.push(clientKey);

    if (client.groupId) {
      addNode(nodes, "brand_group", client.groupId, "Group", {});
      addEdge(edges, clientKey, nodeId("brand_group", client.groupId), "belongs_to_group");
    }
  }

  if (brand) {
    const brandKey = nodeId("brand", brand.id);
    addNode(nodes, "brand", brand.id, brand.name, {
      documentNumber: brand.documentNumber,
    });
    rootIds.push(brandKey);

    if (client) {
      addEdge(edges, brandKey, nodeId("client", client.id), "owned_by_client");
    }
    if (brand.groupId) {
      addNode(nodes, "brand_group", brand.groupId, "Group", {});
      addEdge(edges, brandKey, nodeId("brand_group", brand.groupId), "in_group");
    }
  }

  if (campaign) {
    const campaignKey = nodeId("campaign", campaign.id);
    addNode(nodes, "campaign", campaign.id, campaign.name, {
      code: campaign.code,
      status: campaign.status,
    });
    rootIds.push(campaignKey);

    if (brand) {
      addEdge(edges, campaignKey, nodeId("brand", brand.id), "for_brand");
    } else if (campaign.brandId) {
      addNode(nodes, "brand", campaign.brandId, "Brand", {});
      addEdge(edges, campaignKey, nodeId("brand", campaign.brandId), "for_brand");
    }

    if (client) {
      addEdge(edges, campaignKey, nodeId("client", client.id), "for_client");
    } else if (campaign.clientId) {
      addNode(nodes, "client", campaign.clientId, "Client", {});
      addEdge(edges, campaignKey, nodeId("client", campaign.clientId), "for_client");
    }

    addNode(nodes, "campaign_line", `${campaign.id}:lines`, "Campaign Lines", {
      placeholder: true,
    });
    addEdge(edges, campaignKey, nodeId("campaign_line", `${campaign.id}:lines`), "has_lines");

    addNode(nodes, "deliverable", `${campaign.id}:deliverables`, "Deliverables", {
      placeholder: true,
    });
    addEdge(
      edges,
      campaignKey,
      nodeId("deliverable", `${campaign.id}:deliverables`),
      "has_deliverables"
    );

    addNode(nodes, "invoice", `${campaign.id}:invoices`, "Invoices", { placeholder: true });
    addEdge(edges, campaignKey, nodeId("invoice", `${campaign.id}:invoices`), "billed_via");

    addNode(nodes, "purchase_order", `${campaign.id}:pos`, "Purchase Orders", {
      placeholder: true,
    });
    addEdge(
      edges,
      campaignKey,
      nodeId("purchase_order", `${campaign.id}:pos`),
      "funded_by"
    );
  }

  for (const creator of snapshots.creators ?? []) {
    const creatorKey = nodeId("creator", creator.id);
    addNode(nodes, "creator", creator.id, creator.displayName ?? creator.handle ?? creator.id, {
      handle: creator.handle,
      platform: creator.platform,
    });
    rootIds.push(creatorKey);

    addNode(nodes, "publication", `${creator.id}:publications`, "Publications", {
      placeholder: true,
    });
    addEdge(
      edges,
      creatorKey,
      nodeId("publication", `${creator.id}:publications`),
      "publishes"
    );

    addNode(nodes, "payment", `${creator.id}:payments`, "Payments", { placeholder: true });
    addEdge(edges, creatorKey, nodeId("payment", `${creator.id}:payments`), "receives");

    if (campaign) {
      addEdge(edges, nodeId("campaign", campaign.id), creatorKey, "includes_creator");
    }
  }

  for (const entity of entities) {
    if (entity.type === "shortlist") {
      const key = nodeId("shortlist", entity.id);
      addNode(nodes, "shortlist", entity.id, entity.label);
      rootIds.push(key);
      if (campaign) {
        addEdge(edges, key, nodeId("campaign", campaign.id), "related_to_campaign");
      }
    }
    if (entity.type === "invoice" && entity.confidence >= 80) {
      addNode(nodes, "invoice", entity.id, entity.label);
      if (campaign) {
        addEdge(
          edges,
          nodeId("invoice", entity.id),
          nodeId("campaign", campaign.id),
          "for_campaign"
        );
      }
    }
    if (entity.type === "quotation" && entity.confidence >= 80) {
      addNode(nodes, "quotation", entity.id, entity.label);
    }
    if (entity.type === "platform") {
      addNode(nodes, "platform", entity.id, entity.label);
    }
    if (entity.type === "hashtag") {
      addNode(nodes, "hashtag", entity.id, entity.label);
    }
  }

  if (workspace.shortlist) {
    const key = nodeId("shortlist", workspace.shortlist.id);
    addNode(nodes, "shortlist", workspace.shortlist.id, workspace.shortlist.name);
    if (!rootIds.includes(key)) rootIds.push(key);
  }

  return {
    nodes: [...nodes.values()],
    edges,
    rootIds: [...new Set(rootIds)],
  };
}

export function traverseRelationships(
  graph: RelationshipGraph,
  startNodeId: string,
  relation?: string,
  depth = 2
): RelationshipNode[] {
  const visited = new Set<string>();
  const result: RelationshipNode[] = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  function walk(nodeId: string, currentDepth: number): void {
    if (currentDepth > depth || visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (node) result.push(node);

    for (const edge of graph.edges) {
      if (edge.from === nodeId && (!relation || edge.relation === relation)) {
        walk(edge.to, currentDepth + 1);
      }
      if (edge.to === nodeId && (!relation || edge.relation === relation)) {
        walk(edge.from, currentDepth + 1);
      }
    }
  }

  walk(startNodeId, 0);
  return result;
}
