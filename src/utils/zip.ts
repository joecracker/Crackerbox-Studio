import { flattenFiles } from "../data/demoFiles";
import type { DemoFile } from "../data/demoFiles";

interface ZipEntry {
  path: string;
  name: Uint8Array;
  content: Uint8Array;
  crc: number;
  offset: number;
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  length = 0;

  writeBytes(bytes: Uint8Array) {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  writeU16(value: number) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    this.writeBytes(bytes);
  }

  writeU32(value: number) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
    this.writeBytes(bytes);
  }

  finish(type?: string): Blob {
    const joined = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }
    return new Blob([joined], type ? { type } : undefined);
  }
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildZip(files: DemoFile[]): Blob {
  const entries: ZipEntry[] = [];
  for (const file of flattenFiles(files)) {
    if (file.content == null) continue;
    const content = new TextEncoder().encode(file.content);
    entries.push({
      path: file.path,
      name: new TextEncoder().encode(file.path),
      content,
      crc: crc32(content),
      offset: 0,
    });
  }

  const writer = new ByteWriter();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const centralOffsets: number[] = [];

  for (const entry of entries) {
    entry.offset = writer.length;
    writer.writeU32(0x04034b50); // local file header signature
    writer.writeU16(20); // version needed to extract
    writer.writeU16(0); // general purpose flags
    writer.writeU16(0); // compression method: store
    writer.writeU16(dosTime & 0xffff);
    writer.writeU16(dosDate & 0xffff);
    writer.writeU32(entry.crc);
    writer.writeU32(entry.content.length);
    writer.writeU32(entry.content.length);
    writer.writeU16(entry.name.length);
    writer.writeU16(0); // extra field length
    writer.writeBytes(entry.name);
    writer.writeBytes(entry.content);
  }

  const cdOffset = writer.length;
  entries.forEach((entry, i) => {
    centralOffsets[i] = writer.length;
    writer.writeU32(0x02014b50); // central directory header signature
    writer.writeU16(20); // version made by
    writer.writeU16(20); // version needed
    writer.writeU16(0); // flags
    writer.writeU16(0); // method: store
    writer.writeU16(dosTime & 0xffff);
    writer.writeU16(dosDate & 0xffff);
    writer.writeU32(entry.crc);
    writer.writeU32(entry.content.length);
    writer.writeU32(entry.content.length);
    writer.writeU16(entry.name.length);
    writer.writeU16(0); // extra length
    writer.writeU16(0); // comment length
    writer.writeU16(0); // disk number
    writer.writeU16(0); // internal attributes
    writer.writeU32(0); // external attributes
    writer.writeU32(entry.offset); // local header offset
    writer.writeBytes(entry.name);
  });
  const cdSize = writer.length - cdOffset;

  writer.writeU32(0x06054b50); // end of central directory
  writer.writeU16(0); // disk number
  writer.writeU16(0); // disk with cd
  writer.writeU16(entries.length);
  writer.writeU16(entries.length);
  writer.writeU32(cdSize);
  writer.writeU32(cdOffset);
  writer.writeU16(0); // comment length

  return writer.finish("application/zip");
}
