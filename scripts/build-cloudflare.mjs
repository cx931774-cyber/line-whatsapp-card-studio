import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const vinextCli = fileURLToPath(new URL("./cli.js", import.meta.resolve("vinext")));

const result = spawnSync(
  process.execPath,
  [vinextCli, "build", ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      CODEX_LOCAL_PREVIEW: "0",
    },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
