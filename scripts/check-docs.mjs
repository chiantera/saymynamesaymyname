import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const skipped=new Set(['.git','.local','.venv','.pytest_cache','__pycache__','.temp','node_modules','dist','android','schedapro']);
const files=[];
async function walk(path) {
  for (const entry of await readdir(path,{withFileTypes:true})) {
    if (skipped.has(entry.name) || entry.isSymbolicLink()) continue;
    const full=join(path,entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
  }
}
await walk(root);
const sources=new Map(await Promise.all(files.map(async file=>[file,await readFile(file,'utf8')])));
function anchors(source) {
  const ids=new Set([...source.matchAll(/\bid=["']([^"']+)["']/g)].map(match=>match[1]));
  const counts=new Map();
  for (const match of source.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const slug=match[1].toLowerCase().replace(/<[^>]+>/g,'').replace(/[^\p{L}\p{N}_ -]/gu,'').replace(/ /g,'-');
    const n=counts.get(slug)??0; counts.set(slug,n+1); ids.add(slug+(n?`-${n}`:''));
  }
  return ids;
}
let links=0;
for (const [file,source] of sources) {
  for (const match of source.matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const value=match[1].replace(/^<([^>]+)>.*$/,'$1').replace(/\s+["'][\s\S]*$/,'');
    if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) continue;
    const [path,fragment]=value.split('#');
    const target=path?resolve(dirname(file),decodeURIComponent(path)):file;
    const within=relative(root,target);
    assert.ok(within!=='..' && !within.startsWith('..'+sep) && !isAbsolute(within),`Link escapes workspace: ${relative(root,file)} -> ${value}`);
    assert.ok(!relative(root,target).split(sep).includes('.local'),`Private artifact link in public docs: ${relative(root,file)}`);
    try { await stat(target); } catch { assert.fail(`Broken link: ${relative(root,file)} -> ${value}`); }
    if (fragment && extname(target)==='.md') {
      const targetSource=sources.get(target)??await readFile(target,'utf8');
      assert.ok(anchors(targetSource).has(decodeURIComponent(fragment)),`Broken anchor: ${relative(root,file)} -> ${value}`);
    }
    ++links;
  }
}
const get=name=>sources.get(join(root,name));
assert.ok(get('CLAUDE.md').includes('[AGENTS.md](AGENTS.md)'),'CLAUDE must point to the single agent guide');
for (const [name,max] of [['CLAUDE.md',12],['CURRENT-TASK.md',70],['PLAN.md',100],['AGENTS.md',160]]) {
  assert.ok(get(name).split('\n').length<=max,`${name} is becoming a duplicate log/spec again`);
}
assert.ok(get('PLAN.md').includes('docs/plan/'),'Plan must index the topic specifications');
const sectionIds=[];
for (const [file,source] of sources) if (file.startsWith(join(root,'docs','plan')+sep)) {
  sectionIds.push(...[...source.matchAll(/id="(section-[^"]+)"/g)].map(match=>match[1]));
}
assert.equal(new Set(sectionIds).size,sectionIds.length,'A numbered specification has multiple authoritative copies');
const indexed=[...get('PLAN.md').matchAll(/\.md#(section-[^)]+)/g)].map(match=>match[1]);
assert.deepEqual(indexed.toSorted(),sectionIds.toSorted(),'Plan index must preserve every numbered section exactly once');
console.log(`Documentation checked: ${files.length} Markdown files, ${links} local targets/anchors, single guide and indexed specifications.`);
