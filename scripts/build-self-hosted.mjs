import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const basePath = "/thuviendethi";
const vinextCli = fileURLToPath(
  new URL("../node_modules/vinext/dist/cli.js", import.meta.url),
);
const result = spawnSync(process.execPath, [vinextCli, "build"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    MATHORA_SELF_HOSTED: "1",
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

// Vinext's App Router standalone server strips basePath for page routing, but
// currently checks static assets before doing so. Patch the packaged runtime
// so requests mounted below /thuviendethi resolve to dist/client/assets.
const standaloneServer = fileURLToPath(
  new URL(
    "../dist/standalone/node_modules/vinext/dist/server/prod-server.js",
    import.meta.url,
  ),
);
const source = readFileSync(standaloneServer, "utf8");
const assetLookup =
  'if (pathname.startsWith("/assets/") && await tryServeStatic(req, res, clientDir, pathname, compress, staticCache)) return;';
const patchedAssetLookup = `const staticLookupPath = stripBasePath(pathname, ${JSON.stringify(basePath)});
\t\tif (staticLookupPath.startsWith("/assets/") && await tryServeStatic(req, res, clientDir, staticLookupPath, compress, staticCache)) return;`;

if (!source.includes(assetLookup)) {
  throw new Error(
    "Unable to patch Vinext standalone asset routing; runtime layout changed.",
  );
}

writeFileSync(
  standaloneServer,
  source.replace(assetLookup, patchedAssetLookup),
  "utf8",
);

// Keep the packaged static-file index URL-shaped on Windows as well. This
// makes local verification match Linux and avoids cache misses on backslashes.
const standaloneStaticCache = fileURLToPath(
  new URL(
    "../dist/standalone/node_modules/vinext/dist/server/static-file-cache.js",
    import.meta.url,
  ),
);
const staticCacheSource = readFileSync(standaloneStaticCache, "utf8");
const relativePathLookup =
  "relativePath: path.relative(base, batch[j]),";
const normalizedRelativePathLookup =
  'relativePath: path.relative(base, batch[j]).replaceAll(path.sep, "/"),';

if (!staticCacheSource.includes(relativePathLookup)) {
  throw new Error(
    "Unable to normalize Vinext standalone static paths; runtime layout changed.",
  );
}

writeFileSync(
  standaloneStaticCache,
  staticCacheSource.replace(
    relativePathLookup,
    normalizedRelativePathLookup,
  ),
  "utf8",
);
