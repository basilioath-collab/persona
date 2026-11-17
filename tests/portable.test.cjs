const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
function fakePe() {
  const bytes=Buffer.alloc(128); bytes.write('MZ'); bytes.writeUInt32LE(64,0x3c);
  bytes.write('PE\0\0',64); bytes.writeUInt16LE(0x8664,68); return bytes;
}
test('portable packaging includes only the application, required loader and instructions, with matching hashes', async () => {
  const { packagePortable }=await import('../scripts/package-portable.mjs');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'persona-portable-'));
  try {
    const releaseDir=path.join(dir,'release'), outputDir=path.join(dir,'portable');
    await fs.mkdir(releaseDir); await fs.writeFile(path.join(releaseDir,'persona-companion.exe'),fakePe());
    await fs.writeFile(path.join(releaseDir,'WebView2Loader.dll'),'test-loader');
    await fs.writeFile(path.join(releaseDir,'personal-database.json'),'private fixture: must not be copied');
    await fs.writeFile(path.join(releaseDir,'preferences.json'),'private fixture');
    const files=await packagePortable({releaseDir,outputDir,requireLoader:true});
    assert.deepEqual((await fs.readdir(outputDir)).sort(),files.sort());
    assert.ok(!files.some(name=>name.endsWith('.json')));
    const sums=await fs.readFile(path.join(outputDir,'SHA256SUMS.txt'),'utf8');
    for(const line of sums.trim().split(/\r?\n/)) {
      const [hash,name]=line.split('  ');
      assert.equal(hash,createHash('sha256').update(await fs.readFile(path.join(outputDir,name))).digest('hex'));
    }
    // A refresh for a static-loader MSVC build must not retain a stale dynamic loader.
    await fs.rm(path.join(releaseDir,'WebView2Loader.dll'));
    await packagePortable({releaseDir,outputDir});
    assert.ok(!(await fs.readdir(outputDir)).includes('WebView2Loader.dll'));
    await assert.rejects(packagePortable({releaseDir,outputDir,requireLoader:true}),/ausente/);
    await fs.writeFile(path.join(releaseDir,'persona-companion.exe'),'not a Windows executable');
    await assert.rejects(packagePortable({releaseDir,outputDir}),/Windows x64/);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
