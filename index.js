const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { finished } = require("stream/promises");
const { spawn } = require("child_process");
const tar = require("tar");

async function downloadFile(url, file) {
  const { body } = await fetch(url);
  const ws = fs.createWriteStream(file);
  await finished(Readable.fromWeb(body).pipe(ws));
}

async function downloadHeaders(nwVersion) {
  const headersUrl = `https://dl.nwjs.io/v${nwVersion}/nw-headers-v${nwVersion}.tar.gz`;
  const headersPath = `./nw-headers-v${nwVersion}.tar.gz`;
  console.log("Downloading headers...");
  console.log(`  ${headersUrl}`);
  await downloadFile(headersUrl, headersPath);

  console.log("Extracting headers...");
  await tar.extract({ file: headersPath, cwd: process.cwd() });
}

async function downloadLib(nwVersion, arch, name) {
  fs.mkdirSync("./node/Release", { recursive: true });
  const libUrl =
    arch === "ia32"
      ? `http://node-webkit.s3.amazonaws.com/v${nwVersion}/${name}.lib`
      : `http://node-webkit.s3.amazonaws.com/v${nwVersion}/${arch}/${name}.lib`;
  const libPath = `./node/Release/${name}.lib`;
  console.log(`Downloading ${name}.lib...`);
  console.log(`  ${libUrl}`);
  await downloadFile(libUrl, libPath);
}

function addNwLibToAdditionalDependencies() {
  console.log("Adding nw.lib to common.gypi...");
  let commonGypi = fs.readFileSync("./node/common.gypi", "utf8");
  commonGypi = commonGypi.replace(/'winmm.lib',.*/, "'winmm.lib', '../node/Release/nw.lib',");
  fs.writeFileSync("./node/common.gypi", commonGypi);
}

async function rebuild(nwVersion, arch) {
  console.log("Getting node version...");
  console.log("  https://nwjs.io/versions.json");
  const { versions } = await fetch("https://nwjs.io/versions.json").then((res) => res.json());
  const nodeVersion = versions.find(({ version }) => version === `v${nwVersion}`).components.node;

  console.log("Rebuilding...");
  console.log(`    nw: ${nwVersion}`);
  console.log(`  node: ${nodeVersion}`);
  console.log(`  arch: ${arch}`);
  const command = /^win/.test(process.platform) ? "node-gyp.cmd" : "node-gyp";
  const args = ["rebuild", `--target=${nodeVersion}`, `--arch=${arch}`, `--nodedir=${path.resolve("./node")}`];
  spawn(command, args, { stdio: "inherit" });
}

async function run(nwVersion, arch) {
  await downloadHeaders(nwVersion);
  await downloadLib(nwVersion, arch, "node");
  if (process.platform === "win32") {
    await downloadLib(nwVersion, arch, "nw");
    addNwLibToAdditionalDependencies();
  }
  rebuild(nwVersion, arch);
}

// run("0.99.0", "x64");
const nwVersion = require("./package.json").devDependencies.nw;
run(nwVersion, process.arch);
