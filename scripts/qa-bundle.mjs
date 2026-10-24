import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const RAW_LIMIT = Number(process.env.QA_BUNDLE_RAW_LIMIT ?? 430 * 1024);
const GZIP_LIMIT = Number(process.env.QA_BUNDLE_GZIP_LIMIT ?? 140 * 1024);

const html = await readFile(path.join("dist", "index.html"), "utf8");
const match = html.match(/src="([^"]*assets\/index-[^"]+\.js)"/);
if (!match) {
  console.error("번들 검사 실패: dist/index.html에서 엔트리 스크립트를 찾지 못했습니다.");
  process.exit(1);
}
const entry = path.join("dist", match[1].replace(/^\.?\//, ""));
const raw = await readFile(entry);
const gzip = gzipSync(raw);
const rawKb = raw.byteLength / 1024;
const gzipKb = gzip.byteLength / 1024;
const passed = raw.byteLength <= RAW_LIMIT && gzip.byteLength <= GZIP_LIMIT;

console.log(`엔트리: ${entry}`);
console.log(
  `raw ${rawKb.toFixed(1)}KB (한도 ${(RAW_LIMIT / 1024).toFixed(0)}KB) · gzip ${gzipKb.toFixed(1)}KB (한도 ${(GZIP_LIMIT / 1024).toFixed(0)}KB)`,
);
if (!passed) {
  console.error("번들 예산을 초과했습니다. 지연 로드나 코드 분할을 확인해 주세요.");
  process.exit(1);
}
console.log("번들 예산 통과");
