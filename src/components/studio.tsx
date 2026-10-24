"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight, ArrowRight, Check, ChevronDown, CircleHelp, Clipboard, Cloud,
  Columns3, Copy, Database, FileCode2, GitBranch, KeyRound, Link2, ListFilter,
  LoaderCircle, PanelRightClose, Play, Plus, Search, Share2, ShieldCheck,
  Sparkles, Table2, X,
} from "lucide-react";
import SchemaCanvas from "@/components/schema-canvas";
import { DEMO_SQL } from "@/lib/demo";
import { decodeSql, encodeSql } from "@/lib/share";
import { parseSql, type DbTable, type Schema } from "@/lib/schema";

const STORAGE_KEY = "forma-schema-v1";

function Metric({ icon: Icon, label, value }: { icon: typeof Table2; label: string; value: number }) {
  return <div className="metric"><Icon size={15} strokeWidth={1.8} /><strong>{value}</strong><span>{label}</span></div>;
}

function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={"pill " + className}>{children}</span>;
}

function IconButton({ title, onClick, children, className = "" }: { title: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return <button type="button" aria-label={title} title={title} onClick={onClick} className={"icon-button " + className}>{children}</button>;
}

function DetailPanel({ table, schema, onClose }: { table: DbTable | null; schema: Schema; onClose: () => void }) {
  const relations = table ? schema.relations.filter((relation) => relation.fromTable === table.id || relation.toTable === table.id) : [];
  return (
    <aside className="detail-panel">
      <div className="panel-heading">
        <div><div className="eyebrow">INSPECTOR</div><h2>{table ? "Table details" : "Schema overview"}</h2></div>
        <IconButton title="Close inspector" onClick={onClose}><PanelRightClose size={17} /></IconButton>
      </div>
      {table ? (
        <div className="detail-scroll">
          <div className="inspector-title-card">
            <div className="inspector-title-icon"><Table2 size={20} strokeWidth={1.7} /></div>
            <h3>{table.name}</h3>
            <span>{table.columns.length} columns · {table.indexes.length} indexes</span>
          </div>
          <div className="detail-section">
            <div className="section-title"><span>Columns</span><Pill>{table.columns.length}</Pill></div>
            <div className="detail-columns">
              {table.columns.map((column) => (
                <div className="detail-column" key={column.name}>
                  <div className="detail-column-main">
                    <span className={"detail-symbol " + (column.primary ? "detail-symbol-key" : "")}>{column.primary ? <KeyRound size={13} /> : <span className="detail-symbol-dot" />}</span>
                    <span>{column.name}</span>
                    {!column.nullable && <span className="required-dot" title="Required" />}
                  </div>
                  <div className="detail-column-sub"><code>{column.type}</code>{column.primary && <Pill className="pill-accent">PK</Pill>}{column.unique && !column.primary && <Pill>UNIQUE</Pill>}</div>
                  {column.defaultValue && <div className="default-value">Default: {column.defaultValue}</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="detail-section">
            <div className="section-title"><span>Relationships</span><Pill>{relations.length}</Pill></div>
            {relations.length ? relations.map((relation) => {
              const outgoing = relation.fromTable === table.id;
              const other = schema.tables.find((candidate) => candidate.id === (outgoing ? relation.toTable : relation.fromTable));
              return (
                <div className="relation-item" key={relation.id}>
                  <span className="relation-icon"><GitBranch size={15} /></span>
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-[#3c4650]">{outgoing ? relation.fromColumns.join(", ") : relation.toColumns.join(", ")} <ArrowRight size={12} className="inline text-[#94a0aa]" /> {other?.name || (outgoing ? relation.toTable : relation.fromTable)}</div>
                    <div className="mt-1 text-[11px] text-[#98a2ab]">{outgoing ? "References" : "Referenced by"} · {outgoing ? relation.toColumns.join(", ") : relation.fromColumns.join(", ")}</div>
                  </div>
                </div>
              );
            }) : <p className="empty-detail">No relationships for this table.</p>}
          </div>
          <div className="detail-section">
            <div className="section-title"><span>Indexes</span><Pill>{table.indexes.length}</Pill></div>
            {table.indexes.length ? table.indexes.map((index) => (
              <div className="index-item" key={index.name}>
                <span className="index-icon"><ListFilter size={14} /></span>
                <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold text-[#47515b]">{index.name}</div><div className="mt-1 truncate text-[11px] text-[#98a2ab]">{index.columns.join(", ")}</div></div>
                {index.primary ? <Pill className="pill-accent">PRIMARY</Pill> : index.unique ? <Pill>UNIQUE</Pill> : null}
              </div>
            )) : <p className="empty-detail">No indexes detected.</p>}
          </div>
        </div>
      ) : (
        <div className="detail-scroll">
          <div className="overview-illustration"><div className="overview-orbit orbit-one" /><div className="overview-orbit orbit-two" /><Database size={32} strokeWidth={1.25} /></div>
          <h3 className="overview-heading">A clearer view of<br />your data.</h3>
          <p className="overview-copy">Select a table to explore its columns, keys, indexes, and connections in detail.</p>
          <div className="overview-stats">
            <div><strong>{schema.tables.length}</strong><span>Tables</span></div>
            <div><strong>{schema.relations.length}</strong><span>Relations</span></div>
            <div><strong>{schema.tables.reduce((sum, table) => sum + table.indexes.length, 0)}</strong><span>Indexes</span></div>
          </div>
          <div className="legend">
            <div className="section-title"><span>Diagram guide</span></div>
            <div><span className="legend-icon"><KeyRound size={13} /></span> Primary key</div>
            <div><span className="legend-icon"><Link2 size={13} /></span> Reference column</div>
            <div><span className="legend-line" /> Table relationship</div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default function Studio() {
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [sql, setSql] = useState(DEMO_SQL);
  const [name, setName] = useState("Untitled schema");
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [tab, setTab] = useState<"editor" | "tables">("editor");
  const deferredSql = useDeferredValue(sql);
  const schema = useMemo(() => parseSql(deferredSql), [deferredSql]);
  const selectedTable = schema.tables.find((table) => table.id === selected) || null;
  const totalColumns = schema.tables.reduce((sum, table) => sum + table.columns.length, 0);
  const totalIndexes = schema.tables.reduce((sum, table) => sum + table.indexes.length, 0);
  const filteredTables = schema.tables.filter((table) => table.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    let active = true;
    async function restore() {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("share");
      const packed = params.get("s");
      if (id || packed) {
        try {
          const sharedSql = id
            ? await fetch("/api/share/" + encodeURIComponent(id)).then(async (response) => {
                if (!response.ok) throw new Error("Could not load this share link.");
                return (await response.json() as { sql: string }).sql;
              })
            : await decodeSql(packed!);
          if (active) { setSql(sharedSql); setName("Shared schema"); setToast({ message: "Shared schema loaded", kind: "success" }); }
        } catch { if (active) setToast({ message: "Could not open this share link", kind: "error" }); }
      } else {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as { sql?: string; name?: string } | null;
          if (active && saved && typeof saved.sql === "string") { setSql(saved.sql); setName(saved.name || "Untitled schema"); }
        } catch { /* Ignore malformed local data. */ }
      }
      if (active) setLoaded(true);
    }
    restore();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ sql, name, updatedAt: Date.now() })); }
    catch { setToast({ message: "Browser storage is full; your current edit is still available.", kind: "error" }); }
  }, [loaded, sql, name]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (selected && !schema.tables.some((table) => table.id === selected)) setSelected(null);
  }, [schema, selected]);

  const selectTable = (id: string | null) => {
    setSelected(id);
    if (id) setInspectorOpen(true);
  };
  const share = async () => {
    if (!sql.trim()) { setToast({ message: "Add some SQL before sharing", kind: "error" }); return; }
    setSharing(true);
    try {
      let link = "";
      try {
        const response = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql }) });
        if (response.ok) {
          const result = await response.json() as { id: string };
          if (result.id) link = window.location.origin + "/?share=" + encodeURIComponent(result.id);
        }
      } catch { /* Use portable link below. */ }
      if (!link) link = window.location.origin + "/?s=" + await encodeSql(sql);
      await navigator.clipboard.writeText(link);
      setToast({ message: "Link copied", kind: "success" });
    } catch {
      setToast({ message: "Could not copy the link. Check clipboard permission.", kind: "error" });
    } finally { setSharing(false); }
  };
  const copySql = async () => {
    try { await navigator.clipboard.writeText(sql); setToast({ message: "SQL copied to clipboard", kind: "success" }); }
    catch { setToast({ message: "Could not copy SQL", kind: "error" }); }
  };
  const loadDemo = () => { setSql(DEMO_SQL); setName("Commerce schema"); setSelected(null); setToast({ message: "Example schema loaded", kind: "success" }); };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><span /><span /><span /><span /></span><span>forma<span className="brand-period">.</span></span></div>
        <div className="topbar-divider" />
        <div className="workspace-label"><span className="workspace-icon"><Database size={15} /></span><input aria-label="Schema name" value={name} onChange={(event) => setName(event.target.value)} maxLength={64} /><ChevronDown size={14} /></div>
        <div className="topbar-spacer" />
        <div className="saved-state"><span className="saved-dot" /> Saved locally</div>
        <span className="topbar-divider compact" />
        <button className="share-button" onClick={share} disabled={sharing}>{sharing ? <LoaderCircle size={15} className="animate-spin" /> : <Share2 size={15} />}<span>Share schema</span></button>
      </header>

      <div className="workspace">
        <aside className="left-panel">
          <div className="left-panel-intro"><div className="eyebrow">WORKSPACE / 01</div><h1>SQL to clarity<span>.</span></h1><p>Paste your schema. See the bigger picture.</p></div>
          <div className="sidebar-tabs"><button className={tab === "editor" ? "active" : ""} onClick={() => setTab("editor")}><FileCode2 size={14} /> SQL editor</button><button className={tab === "tables" ? "active" : ""} onClick={() => setTab("tables")}><Table2 size={14} /> Tables <span>{schema.tables.length}</span></button></div>
          {tab === "editor" ? (
            <div className="editor-tab">
              <div className="editor-heading"><span><span className="live-dot" /> schema.sql</span><div><IconButton title="Copy SQL" onClick={copySql}><Copy size={15} /></IconButton><IconButton title="Clear SQL" onClick={() => { setSql(""); setSelected(null); }}><X size={15} /></IconButton></div></div>
              <div className="editor-wrap"><div className="line-numbers" ref={lineNumbersRef} aria-hidden="true">{sql.split("\n").map((_, index) => <div key={index}>{index + 1}</div>)}</div><textarea aria-label="SQL schema editor" spellCheck={false} value={sql} onChange={(event) => setSql(event.target.value)} onScroll={(event) => { if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop; }} placeholder={"CREATE TABLE users (\n  id UUID PRIMARY KEY,\n  email TEXT NOT NULL\n);"} /></div>
              <div className="editor-footer"><span><Check size={13} /> Auto-saved</span><button onClick={loadDemo}><Sparkles size={13} /> Load example</button></div>
            </div>
          ) : (
            <div className="table-list-tab">
              <label className="table-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a table..." /></label>
              <div className="table-list">{filteredTables.length ? filteredTables.map((table) => <button key={table.id} className={selected === table.id ? "selected" : ""} onClick={() => selectTable(table.id)}><span className="list-table-icon"><Table2 size={15} /></span><span className="truncate">{table.name}</span><span className="list-count">{table.columns.length}</span></button>) : <div className="table-list-empty">No tables found</div>}</div>
            </div>
          )}
          <div className="sidebar-bottom"><span className="sidebar-bottom-icon"><CircleHelp size={16} /></span><div><strong>Getting started</strong><p>Paste CREATE TABLE statements to map your database.</p></div><ArrowDownRight size={16} /></div>
        </aside>

        <main className="main-panel">
          <div className="main-heading">
            <div><div className="eyebrow">VISUAL SCHEMA <span className="eyebrow-separator">/</span> DIAGRAM</div><h2>{schema.tables.length ? "The shape of your data" : "Your canvas is ready"}<span className="heading-sparkle">✦</span></h2><p>{schema.tables.length ? "Every table, key, and connection in one calm view." : "Add SQL in the editor to create your diagram."}</p></div>
            <div className="heading-actions"><button className="quiet-button" onClick={() => setInspectorOpen(!inspectorOpen)}><Columns3 size={15} /> {inspectorOpen ? "Hide details" : "Show details"}</button></div>
          </div>
          <div className="metrics-row"><Metric icon={Table2} label="tables" value={schema.tables.length} /><Metric icon={Columns3} label="columns" value={totalColumns} /><Metric icon={GitBranch} label="relations" value={schema.relations.length} /><Metric icon={ListFilter} label="indexes" value={totalIndexes} /></div>
          <div className="diagram-head"><div><span className="diagram-head-icon"><GitBranch size={15} /></span><strong>Relationship diagram</strong><Pill>LIVE</Pill></div><div className="diagram-head-right"><span className="diagram-head-dot" /> Updated as you type</div></div>
          <div className="diagram-area">
            {schema.tables.length ? <SchemaCanvas schema={schema} selectedTable={selected} onSelect={selectTable} /> : <div className="canvas-empty"><span><Database size={30} strokeWidth={1.3} /></span><h3>Nothing to map yet</h3><p>Paste a CREATE TABLE statement in the SQL editor. Your diagram will appear here.</p><button onClick={loadDemo}><Play size={13} fill="currentColor" /> Explore an example</button></div>}
          </div>
          {schema.warnings.length > 0 && <div className="warnings"><CircleHelp size={15} /><span>{schema.warnings.slice(0, 2).join(" ")}</span></div>}
          <div className="main-footer"><div><ShieldCheck size={15} /> Your edits stay in this browser</div><div>Made for the way you think about data <span>✳</span></div></div>
        </main>
        {inspectorOpen && <DetailPanel table={selectedTable} schema={schema} onClose={() => setInspectorOpen(false)} />}
      </div>
      {toast && <div className={"toast toast-" + toast.kind} role={toast.kind === "error" ? "alert" : "status"}><span className="toast-icon">{toast.kind === "success" ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}</span>{toast.message}</div>}
    </div>
  );
}
