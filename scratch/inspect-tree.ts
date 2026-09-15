import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'app', 'api', 'v1', 'rpm', '[id]', 'attachments');
console.log('Dir exists?', fs.existsSync(dir));
const files = fs.readdirSync(dir);
for (const f of files) {
  console.log(f, Buffer.from(f).toJSON().data);
}

const subDir = path.join(dir, '[attachmentId]');
console.log('Subdir exists?', fs.existsSync(subDir));
const subFiles = fs.readdirSync(subDir);
for (const f of subFiles) {
  console.log(f, Buffer.from(f).toJSON().data);
}

const downloadDir = path.join(subDir, 'download');
console.log('DownloadDir exists?', fs.existsSync(downloadDir));
const dlFiles = fs.readdirSync(downloadDir);
for (const f of dlFiles) {
  console.log(f, Buffer.from(f).toJSON().data);
}
