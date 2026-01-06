const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function commandExists(cmd) {
    try { execSync(`command -v ${cmd}`, { stdio: 'ignore' }); return true; } catch (e) { return false; }
}
function isArm64() { return os.arch() === 'arm64'; }
function selfDestruct(exitCode = 0) {
    const mainScript = require('path').join(__dirname, 'main.js');
    try { if (fs.existsSync(mainScript)) { fs.unlinkSync(mainScript); } } catch (e) {}
    process.exit(exitCode);
}
module.exports = { sleep, commandExists, selfDestruct, isArm64 };