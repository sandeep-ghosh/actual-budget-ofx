import { spawn } from "child_process";
import http from "http";
import { setTimeout } from "timers/promises";

const SERVER_URL = "http://127.0.0.1:4000";

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(command, args, { stdio: "inherit" });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function waitForServer(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(SERVER_URL, (res) => {
          res.resume();
          res.on("end", resolve);
        });
        req.on("error", reject);
      });
      return;
    } catch {
      await setTimeout(250);
    }
  }
  throw new Error(
    `Server did not respond at ${SERVER_URL} within ${timeoutMs}ms`,
  );
}

async function main() {
  await runCommand("npm", ["run", "build"]);

  const server = spawn("node", ["dist-server/index.js"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
    process.stdout.write(chunk);
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
    process.stderr.write(chunk);
  });

  try {
    await waitForServer(10000);
    console.log("Smoke test passed: server is responding.");
  } catch (err) {
    throw err;
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error("Smoke test failed:", error);
  process.exit(1);
});
