"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  Position,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import { CircleDot, KeyRound, Link2 } from "lucide-react";
import type { DbTable, Schema } from "@/lib/schema";

type TableNode = Node<{ table: DbTable }, "table">;

function TableCard({ data, selected }: NodeProps<TableNode>) {
  const table = data.table;
  const relationColumns = new Set(table.columns.filter((column) => !column.primary && /_id$/i.test(column.name)).map((column) => column.name));
  const handlePosition = (index: number) => ({ left: ((index + 1) / (table.columns.length + 1)) * 100 + "%" });
  return (
    <div className={"table-node " + (selected ? "table-node-selected" : "")}>
      {table.columns.map((column, index) => (
        <span key={"vertical-" + column.name}>
          <Handle type="source" position={Position.Top} id={"source-top-" + column.name} className="column-handle" style={handlePosition(index)} />
          <Handle type="target" position={Position.Top} id={"target-top-" + column.name} className="column-handle" style={handlePosition(index)} />
          <Handle type="source" position={Position.Bottom} id={"source-bottom-" + column.name} className="column-handle" style={handlePosition(index)} />
          <Handle type="target" position={Position.Bottom} id={"target-bottom-" + column.name} className="column-handle" style={handlePosition(index)} />
        </span>
      ))}
      <div className="table-node-top">
        <span className="table-node-icon"><span className="table-node-icon-grid" /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold tracking-[-0.025em] text-[#252b31]">{table.name}</div>
          <div className="text-[11px] text-[#929ba5]">{table.columns.length} columns</div>
        </div>
        <span className="table-node-more">•••</span>
      </div>
      <div className="table-node-columns">
        {table.columns.map((column) => (
          <div className="table-node-row" key={column.name}>
            <Handle type="target" position={Position.Left} id={"target-left-" + column.name} className="column-handle" />
            <Handle type="source" position={Position.Left} id={"source-left-" + column.name} className="column-handle" />
            <span className={"column-symbol " + (column.primary ? "column-symbol-primary" : relationColumns.has(column.name) ? "column-symbol-link" : "")}>
              {column.primary ? <KeyRound size={11} strokeWidth={2.4} /> : relationColumns.has(column.name) ? <Link2 size={11} strokeWidth={2.4} /> : <CircleDot size={9} strokeWidth={2.1} />}
            </span>
            <span className={"truncate text-[12px] " + (column.primary ? "font-semibold text-[#394149]" : "font-medium text-[#57616b]")}>{column.name}</span>
            <span className="ml-auto pl-2 text-[11px] text-[#a3abb4]">{column.type.toLowerCase()}</span>
            <Handle type="source" position={Position.Right} id={"source-right-" + column.name} className="column-handle" />
            <Handle type="target" position={Position.Right} id={"target-right-" + column.name} className="column-handle" />
          </div>
        ))}
      </div>
      {table.indexes.length > 0 && <div className="table-node-bottom"><span className="small-dot" />{table.indexes.length} {table.indexes.length === 1 ? "index" : "indexes"}</div>}
    </div>
  );
}

const nodeTypes = { table: TableCard };

function buildGraph(schema: Schema, columns: number): { nodes: TableNode[]; edges: ReturnType<typeof buildEdges> } {
  const levels = new Map<string, number>();
  const visiting = new Set<string>();
  const getLevel = (id: string): number => {
    if (levels.has(id)) return levels.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const targets = schema.relations.filter((relation) => relation.fromTable === id && relation.toTable !== id && schema.tables.some((table) => table.id === relation.toTable));
    const level = targets.length ? Math.max(...targets.map((relation) => getLevel(relation.toTable) + 1)) : 0;
    visiting.delete(id);
    levels.set(id, level);
    return level;
  };
  schema.tables.forEach((table) => getLevel(table.id));
  const ordered = [...schema.tables].sort((a, b) => (levels.get(a.id) || 0) - (levels.get(b.id) || 0));
  const nodes: TableNode[] = [];
  let rowY = 0;
  for (let start = 0; start < ordered.length; start += columns) {
    const row = ordered.slice(start, start + columns);
    const rowHeight = Math.max(...row.map((table) => 76 + table.columns.length * 36 + (table.indexes.length ? 33 : 0)));
    row.forEach((table, index) => {
      const height = 76 + table.columns.length * 36 + (table.indexes.length ? 33 : 0);
      nodes.push({
        id: table.id,
        type: "table",
        data: { table },
        position: { x: index * 385 + (start / columns % 2 ? 32 : 0), y: rowY + (rowHeight - height) / 2 },
        draggable: true,
      });
    });
    rowY += rowHeight + 104;
  }
  return { nodes, edges: buildEdges(schema, nodes) };
}

function buildEdges(schema: Schema, nodes: TableNode[]) {
  const positions = new Map(nodes.map((node) => [node.id, node.position]));
  return schema.relations.filter((relation) => schema.tables.some((table) => table.id === relation.toTable)).map((relation, index) => ({
    id: relation.id,
    source: relation.fromTable,
    sourceHandle: (() => {
      const from = positions.get(relation.fromTable)!;
      const to = positions.get(relation.toTable)!;
      const vertical = Math.abs(from.y - to.y) > 70 && Math.abs(from.x - to.x) < 170;
      return "source-" + (vertical ? (from.y > to.y ? "top-" : "bottom-") : (from.x > to.x ? "left-" : "right-")) + relation.fromColumns[0];
    })(),
    target: relation.toTable,
    targetHandle: (() => {
      const from = positions.get(relation.fromTable)!;
      const to = positions.get(relation.toTable)!;
      const vertical = Math.abs(from.y - to.y) > 70 && Math.abs(from.x - to.x) < 170;
      return "target-" + (vertical ? (from.y > to.y ? "bottom-" : "top-") : (from.x > to.x ? "right-" : "left-")) + relation.toColumns[0];
    })(),
    type: "smoothstep",
    animated: false,
    pathOptions: { borderRadius: 18, offset: 28 },
    style: { stroke: index % 2 ? "#aab5bf" : "#8999a7", strokeWidth: 1.8 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: index % 2 ? "#aab5bf" : "#8999a7" },
  }));
}

function AutoFit({ signature }: { signature: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const timeout = window.setTimeout(() => fitView({ padding: 0.18, maxZoom: 1, duration: 250 }), 80);
    return () => window.clearTimeout(timeout);
  }, [signature, fitView]);
  return null;
}

function CanvasInner({ schema, selectedTable, onSelect }: { schema: Schema; selectedTable: string | null; onSelect: (id: string | null) => void }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(2);
  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setColumns(width < 420 ? 1 : Math.max(2, Math.min(4, Math.floor((width + 80) / 365))));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const graph = useMemo(() => buildGraph(schema, columns), [schema, columns]);
  const [nodes, setNodes, onNodesChange] = useNodesState<TableNode>(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
  useEffect(() => { setNodes(graph.nodes.map((node) => ({ ...node, selected: node.id === selectedTable }))); setEdges(graph.edges); }, [graph, setNodes, setEdges]);
  useEffect(() => {
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === selectedTable })));
  }, [selectedTable, setNodes]);

  return (
    <div className="canvas-shell" ref={canvasRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        minZoom={0.22}
        maxZoom={1.65}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        elementsSelectable
      >
        <Background color="#dfe5e9" gap={24} size={1.3} variant={BackgroundVariant.Dots} />
        <MiniMap pannable zoomable nodeColor="#d8e0e5" maskColor="rgba(248, 250, 251, .74)" className="studio-minimap" />
        <Controls position="bottom-right" showInteractive={false} className="studio-controls" />
        <AutoFit signature={columns + ":" + schema.tables.map((table) => table.id + ":" + table.columns.length).join("|")} />
      </ReactFlow>
      <div className="canvas-hint"><span className="canvas-hint-icon">↗</span> Drag to explore · Scroll to zoom</div>
    </div>
  );
}

export default function SchemaCanvas(props: { schema: Schema; selectedTable: string | null; onSelect: (id: string | null) => void }) {
  return <ReactFlowProvider><CanvasInner {...props} /></ReactFlowProvider>;
}
