const https = require('https');
const fs = require('fs');

const data = fs.readFileSync('C:/Users/PC/Desktop/VOLT.apk');

function upload(host, path, method, headers) {
  return new Promise((resolve, reject) => {
    const mod = host === '0x0.st' ? require('http') : https;
    const opts = { hostname: host, path, method, headers, port: host === '0x0.st' ? 80 : 443 };
    const req = mod.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Try 0x0.st - simple pastebin/file host
  try {
    const result = await upload('0x0.st', '/', 'POST', {
      'Content-Type': 'application/octet-stream',
      'Content-Length': data.length
    });
    console.log('0x0.st:', result.trim());
  } catch(e) { console.log('0x0.st error:', e.message); }
}

main();
