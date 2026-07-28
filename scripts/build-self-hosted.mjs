import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const vinextCli = fileURLToPath(
  new URL("../node_modules/vinext/dist/cli.js", import.meta.url),
);
const result = spawnSync(process.execPath, [vinextCli, "build"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    MATHORA_SELF_HOSTED: "1",
    NEXT_PUBLIC_BASE_PATH: "/thuviendethi",
  },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
