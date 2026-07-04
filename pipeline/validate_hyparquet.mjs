// Validate an exported {scope}.parquet with the same reader the frontend uses
// (hyparquet, resolved from this repo's node_modules).
// Usage: node pipeline/validate_hyparquet.mjs pipeline/out/enjalot/dadabase/scopes-001.parquet
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const { parquetRead } = await import(
  new URL('hyparquet/src/index.js', `file://${require.resolve('hyparquet/package.json')}`)
).catch(async () => await import('hyparquet'));

const path = process.argv[2];
if (!path) {
  console.error('usage: node pipeline/validate_hyparquet.mjs <scope.parquet>');
  process.exit(1);
}
const buf = await readFile(path);
const file = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

await new Promise((resolve, reject) => {
  parquetRead({
    file,
    rowFormat: 'object',
    onComplete: (data) => {
      try {
        // mirror apiService.getScopeRows post-processing
        data.forEach((row, i) => {
          row.ls_index = i;
          row.cluster = parseInt(row.cluster);
          row.raw_cluster = parseInt(row.raw_cluster);
          row.tile_index_32 = parseInt(row.tile_index_32);
          row.tile_index_64 = parseInt(row.tile_index_64);
          row.tile_index_128 = parseInt(row.tile_index_128);
        });
        const first = data[0];
        console.log(`hyparquet read OK: ${data.length} rows`);
        console.log('first row:', JSON.stringify(first));
        const bad = data.filter(
          (r) => !Number.isFinite(r.x) || !Number.isFinite(r.y) || !Number.isInteger(r.cluster)
        );
        if (bad.length) throw new Error(`${bad.length} rows with bad x/y/cluster`);
        console.log('x/y/cluster valid on all rows');
        resolve();
      } catch (e) {
        reject(e);
      }
    },
  });
});
