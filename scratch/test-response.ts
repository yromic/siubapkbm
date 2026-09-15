import { NextResponse } from 'next/server';
import fs from 'fs';

async function test() {
  const filePath = "D:\\w\\siubapkbm\\storage\\uploads\\rpm_attachments\\attachment_397f245b-f51e-48ac-b16a-975c483984b5.png";
  const fileBuffer = fs.readFileSync(filePath);
  console.log("fileBuffer is Buffer?", Buffer.isBuffer(fileBuffer));
  console.log("fileBuffer length:", fileBuffer.length);

  const uint8 = new Uint8Array(fileBuffer);
  console.log("uint8 byteLength:", uint8.byteLength);

  const res = new NextResponse(uint8, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(fileBuffer.length)
    }
  });

  console.log("res status:", res.status);
  console.log("res headers:", Array.from(res.headers.entries()));
  const ab = await res.arrayBuffer();
  console.log("res arrayBuffer length:", ab.byteLength);
  console.log("Matching length?", ab.byteLength === fileBuffer.length);
}

test().catch(console.error);
