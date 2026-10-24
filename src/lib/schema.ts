export type Column = { name: string; type: string; nullable: boolean; primary: boolean; unique: boolean; defaultValue?: string };
export type DbIndex = { name: string; columns: string[]; unique: boolean; primary?: boolean };
export type DbTable = { id: string; name: string; columns: Column[]; indexes: DbIndex[] };
export type Relation = { id: string; fromTable: string; fromColumns: string[]; toTable: string; toColumns: string[]; name?: string };
export type Schema = { tables: DbTable[]; relations: Relation[]; warnings: string[] };

export function cleanIdentifier(value: string): string {
  return value.trim().split(".").map((part) => part.trim().replace(/^["\x60\[]|["\x60\]]$/g, "")).join(".");
}
const key = (value: string) => cleanIdentifier(value).toLowerCase();

function stripComments(sql: string): string {
  let output = "", quote = "";
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], next = sql[i + 1];
    if (quote) {
      output += c;
      if (c === quote) {
        if (next === quote) output += sql[++i];
        else quote = "";
      } else if (c === "\\" && next) output += sql[++i];
    } else if (c === "'" || c === '"' || c === "\x60") { quote = c; output += c; }
    else if (c === "-" && next === "-") { while (i < sql.length && sql[i] !== "\n") i++; output += "\n"; }
    else if (c === "/" && next === "*") { i += 2; while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++; i++; output += " "; }
    else output += c;
  }
  return output;
}

function splitOutside(input: string, separator: string): string[] {
  const parts: string[] = [];
  let current = "", depth = 0, quote = "";
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quote) {
      current += c;
      if (c === quote) {
        if (input[i + 1] === quote) current += input[++i];
        else quote = "";
      } else if (c === "\\" && input[i + 1]) current += input[++i];
      continue;
    }
    if (c === "'" || c === '"' || c === "\x60") quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth--;
    if (c === separator && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ""; }
    else current += c;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function closingParen(input: string, opening: number): number {
  let depth = 0, quote = "";
  for (let i = opening; i < input.length; i++) {
    const c = input[i];
    if (quote) { if (c === quote) { if (input[i + 1] === quote) i++; else quote = ""; } continue; }
    if (c === "'" || c === '"' || c === "\x60") quote = c;
    else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i;
  }
  return -1;
}

const columnNames = (value: string) => splitOutside(value, ",").map((part) => cleanIdentifier(part.trim().split(/\s+(?:ASC|DESC|NULLS|COLLATE)\b/i)[0])).filter(Boolean);

function addIndex(table: DbTable, index: DbIndex) {
  if (!index.columns.length) return;
  if (!table.indexes.some((existing) => existing.name.toLowerCase() === index.name.toLowerCase())) table.indexes.push(index);
  for (const column of table.columns) {
    if (!index.columns.some((name) => key(name) === key(column.name))) continue;
    if (index.primary) { column.primary = true; column.nullable = false; }
    if (index.unique && index.columns.length === 1) column.unique = true;
  }
}
function addRelation(schema: Schema, relation: Omit<Relation, "id">) {
  const id = [relation.fromTable, relation.fromColumns.join(","), relation.toTable, relation.toColumns.join(",")].join(":");
  if (!schema.relations.some((item) => item.id === id)) schema.relations.push({ ...relation, id });
}
function parseConstraint(raw: string, table: DbTable, schema: Schema) {
  const named = /^CONSTRAINT\s+((?:"[^"]+"|\x60[^\x60]+\x60|\[[^\]]+\]|\S+))\s+/i.exec(raw);
  const name = named ? cleanIdentifier(named[1]) : undefined;
  const body = named ? raw.slice(named[0].length) : raw;
  const primary = /PRIMARY\s+KEY\s*\(([^)]*)\)/i.exec(body);
  if (primary && /^PRIMARY\s+KEY\b/i.test(body)) { addIndex(table, { name: name || table.name + "_pkey", columns: columnNames(primary[1]), unique: true, primary: true }); return; }
  const unique = /^UNIQUE(?:\s+KEY|\s+INDEX)?(?:\s+[^\s(]+)?\s*\(([^)]*)\)/i.exec(body);
  if (unique) { addIndex(table, { name: name || table.name + "_unique_" + table.indexes.length, columns: columnNames(unique[1]), unique: true }); return; }
  const index = /^(?:INDEX|KEY)\s+([^\s(]+)?\s*\(([^)]*)\)/i.exec(body);
  if (index) { addIndex(table, { name: name || cleanIdentifier(index[1] || table.name + "_idx_" + table.indexes.length), columns: columnNames(index[2]), unique: false }); return; }
  const foreign = /FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+((?:"[^"]+"|\x60[^\x60]+\x60|\[[^\]]+\]|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|\x60[^\x60]+\x60|\[[^\]]+\]|[\w$]+))?)\s*\(([^)]*)\)/i.exec(body);
  if (foreign) addRelation(schema, { name, fromTable: table.id, fromColumns: columnNames(foreign[1]), toTable: key(foreign[2]), toColumns: columnNames(foreign[3]) });
}
function parseColumn(raw: string, table: DbTable, schema: Schema) {
  const match = /^((?:"[^"]+"|\x60[^\x60]+\x60|\[[^\]]+\]|[^\s]+))\s+([\s\S]+)$/i.exec(raw);
  if (!match) return;
  const name = cleanIdentifier(match[1]), body = match[2];
  const stop = /\s+(?=NOT\s+NULL\b|NULL\b|PRIMARY\s+KEY\b|UNIQUE\b|REFERENCES\b|DEFAULT\b|CHECK\b|GENERATED\b|CONSTRAINT\b|COLLATE\b|AUTO_INCREMENT\b|IDENTITY\b)/i.exec(body);
  const type = (stop ? body.slice(0, stop.index) : body).trim();
  const primary = /\bPRIMARY\s+KEY\b/i.test(body), unique = /\bUNIQUE\b/i.test(body);
  const defaultMatch = /\bDEFAULT\s+((?:'[^']*'|"[^"]*"|\([^)]*\)|[^\s,]+))/i.exec(body);
  table.columns.push({ name, type, nullable: !primary && !/\bNOT\s+NULL\b/i.test(body), primary, unique, defaultValue: defaultMatch?.[1] });
  if (primary) addIndex(table, { name: table.name + "_pkey", columns: [name], unique: true, primary: true });
  else if (unique) addIndex(table, { name: table.name + "_" + name + "_key", columns: [name], unique: true });
  const reference = /\bREFERENCES\s+((?:"[^"]+"|\x60[^\x60]+\x60|\[[^\]]+\]|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|\x60[^\x60]+\x60|\[[^\]]+\]|[\w$]+))?)(?:\s*\(([^)]*)\))?/i.exec(body);
  if (reference) addRelation(schema, { fromTable: table.id, fromColumns: [name], toTable: key(reference[1]), toColumns: reference[2] ? columnNames(reference[2]) : ["id"] });
}

export function parseSql(sql: string): Schema {
  const schema: Schema = { tables: [], relations: [], warnings: [] };
  const deferred: string[] = [];
  for (const statement of splitOutside(stripComments(sql), ";")) {
    const create = /^CREATE\s+(?:(?:TEMP|TEMPORARY|UNLOGGED)\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i.exec(statement);
    if (!create) { deferred.push(statement); continue; }
    const opening = statement.indexOf("(", create[0].length), closing = opening >= 0 ? closingParen(statement, opening) : -1;
    if (opening < 0 || closing < 0) { schema.warnings.push("Could not read a CREATE TABLE statement."); continue; }
    const name = cleanIdentifier(statement.slice(create[0].length, opening));
    if (!name) continue;
    const table: DbTable = { id: key(name), name, columns: [], indexes: [] };
    schema.tables.push(table);
    for (const entry of splitOutside(statement.slice(opening + 1, closing), ",")) {
      if (/^(?:CONSTRAINT|PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|INDEX|KEY|CHECK)\b/i.test(entry)) parseConstraint(entry, table, schema);
      else parseColumn(entry, table, schema);
    }
  }
  for (const statement of deferred) {
    const createIndex = /^CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([^\s]+)\s+ON\s+([^\s(]+)(?:\s+USING\s+\w+)?\s*\(([^)]*)\)/i.exec(statement);
    if (createIndex) {
      const table = schema.tables.find((item) => item.id === key(createIndex[3]));
      if (table) addIndex(table, { name: cleanIdentifier(createIndex[2]), columns: columnNames(createIndex[4]), unique: Boolean(createIndex[1]) });
      continue;
    }
    const alter = /^ALTER\s+TABLE\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?([^\s]+)\s+ADD\s+([\s\S]+)$/i.exec(statement);
    if (alter) { const table = schema.tables.find((item) => item.id === key(alter[1])); if (table) parseConstraint(alter[2], table, schema); }
  }
  for (const relation of schema.relations) {
    const target = schema.tables.find((table) => table.id === relation.toTable || table.id.split(".").at(-1) === relation.toTable.split(".").at(-1));
    if (target) relation.toTable = target.id;
    else schema.warnings.push("Referenced table " + relation.toTable + " was not found.");
  }
  if (sql.trim() && schema.tables.length === 0) schema.warnings.push("No CREATE TABLE statements found. Paste SQL DDL to create a diagram.");
  return schema;
}
