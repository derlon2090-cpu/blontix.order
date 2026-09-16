if(process.env.NODE_ENV==='production'||process.env.RENDER==='true')throw new Error('Local PDF QA forbidden in production');
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {PDFBool,PDFDict,PDFDocument,PDFName,PDFRawStream} from 'pdf-lib';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {generateOrderPdf} from '../lib/pdf.ts';
import {pdfTextRuns} from '../lib/pdf-text.ts';
import {documentFontkit} from '../lib/pdf-fontkit.ts';
import {settleStorageTasks} from '../lib/storage-parallel.ts';
import {CUSTOMER_DECLARATION,WARRANTY_TEXT,DIGITAL_POLICY,sha256Bytes,sha256Hex} from '../lib/order-document.ts';
import {FILE_MISMATCH_NOTICE} from '../lib/document-integrity.ts';
const product='Google Gemini – رابط تفعيل عرض 18 شهرًا';
const runs=pdfTextRuns(product);
assert.ok(runs.some(run=>run.includes('Google Gemini')));
assert.ok(runs.some(run=>run.includes('18')));
assert.ok(!runs.some(run=>run.includes('81')));
const numericFont=documentFontkit.create(new Uint8Array(await readFile('node_modules/@ibm/plex/IBM-Plex-Sans-Arabic/fonts/complete/woff/IBMPlexSansArabic-Regular.woff')));
assert.equal(numericFont.layout('١٨').direction,'ltr','Arabic digits must not be shaped in reverse');
assert.equal(numericFont.layout('رابط تفعيل').direction,'rtl');
const finished=[];
const start=performance.now();
await assert.rejects(settleStorageTasks([
  async()=>{throw new Error('upload failed');},
  async()=>{await new Promise(resolve=>setTimeout(resolve,40));finished.push('late upload');},
]),/upload failed/);
assert.deepEqual(finished,['late upload'],'cleanup must wait for late uploads');
let active=0,maxActive=0;
await settleStorageTasks(Array.from({length:4},()=>async()=>{active++;maxActive=Math.max(active,maxActive);await new Promise(resolve=>setTimeout(resolve,30));active--;}));
assert.equal(maxActive,4);
const snapshot={documentReference:'bl-ORD-QA1800-V1',documentVersion:1,verificationId:'VRF-1800-ABCD',orderNumber:'QA-1800',customerName:'عبدالله محمد',customerPhone:'0551234821',productName:product,price:'24.99',orderApprovedAt:'2026-09-16T12:00:00Z',deliveredAt:'2026-09-16T12:15:00Z',deliveryMethod:'واتساب',customerDeclaration:CUSTOMER_DECLARATION,warrantyText:WARRANTY_TEXT,digitalPolicy:DIGITAL_POLICY,imageContentType:'image/png'};
const logo=new Uint8Array(await readFile('public/blontix-logo-v1.png'));
const args={snapshot,reference:'bl-ORD-QA1800-V1',generatedAt:'2026-09-16T12:30:00Z',imageBytes:logo,logoBytes:logo,origin:'https://example.invalid',verificationUrl:'https://example.invalid/verify/isolated-pdf-qa',verificationId:'VRF-1800-ABCD',documentVersion:1,snapshotHash:'a'.repeat(64)};
await mkdir('tmp/pdfs',{recursive:true});
const pdfStart=performance.now();
const bytes=await generateOrderPdf(args);
await writeFile('tmp/pdfs/mixed-after.pdf',bytes);
const pdfMs=Math.round(performance.now()-pdfStart);
await assert.rejects(generateOrderPdf({...args,reference:'different-reference'}),/snapshot identity mismatch/);
const parsed=await PDFDocument.load(bytes,{updateMetadata:false});
assert.equal(parsed.getTitle(),'إقرار شراء وتسليم منتج رقمي');
const info=parsed.context.lookup(parsed.context.trailerInfo.Info,PDFDict);
for(const [name,value] of Object.entries({DocumentStatus:'Final',DocumentReference:args.reference,VerificationID:args.verificationId,ModificationPolicy:'IssueNewVersion'}))assert.equal(info.get(PDFName.of(name)).decodeText(),value);
assert.equal(info.get(PDFName.of('IntegrityProtected')),PDFBool.True);
assert.ok(!info.toString().includes(snapshot.customerPhone));
const xmp=parsed.context.lookup(parsed.catalog.get(PDFName.of('Metadata')),PDFRawStream);
const xml=new TextDecoder().decode(xmp.getContents());
assert.ok(xml.includes(args.reference)&&xml.includes('<bi:DocumentStatus>Final</bi:DocumentStatus>'));
assert.ok(!xml.includes(snapshot.customerPhone));
const originalHash=await sha256Bytes(bytes);
parsed.setSubject('Edited externally — isolated QA');
const altered=await parsed.save();
assert.notEqual(await sha256Bytes(altered),originalHash);
assert.equal(info.get(PDFName.of('DocumentReference')).decodeText(),args.reference);

// Execute real verify/download handlers against an isolated in-memory record.
// No pool, schema, live bucket, migration or persistent database is touched.
process.env.QA_S3_SDK_ENTRY ||= createRequire(import.meta.url).resolve(resolve('node_modules/@aws-sdk/client-s3'));
const {env}=await import('../lib/runtime.ts');
const token='isolated-anti-tamper-token-1234567890';
const tokenHash=await sha256Hex(token);
const row=Object.freeze({id:'isolated-pdf-qa',pdf_sha256:originalHash,pdf_key:'isolated/master.pdf',document_reference:args.reference,document_version:1,verification_id:args.verificationId,lifecycle_status:'final',order_number:'QA-1800',product_name:product,price:'24.99',finalized_at:args.generatedAt,snapshot_hash:args.snapshotHash});
const events=[];
const db={prepare(sql){
  assert.ok(!/(?:UPDATE|INSERT INTO|DELETE FROM) order_documents/i.test(sql),'verify must not overwrite registered master');
  let bindings=[];
  return {bind(...values){bindings=values;return this;},async first(){if(sql.includes('MAX(document_version)'))return {latest_version:1};if(sql.includes('FROM order_documents'))return bindings[0]===tokenHash ? row : null;return {count:1};},async run(){if(sql.includes('verification_events'))events.push(bindings[2]);return {success:true};}};
}};
Object.defineProperty(env,'DB',{get:()=>db});
Object.defineProperty(env,'BUCKET',{get:()=>({async head(){return {size:bytes.byteLength};},async get(){return {body:bytes};}})});
const {POST}=await import('../app/api/verify/[token]/file/route.ts');
const context={params:Promise.resolve({token})};
async function upload(value){const form=new FormData();form.set('file',new File([value],'sample.pdf',{type:'application/pdf'}));return POST(new Request('https://example.invalid/api/verify/file',{method:'POST',body:form}),context);}
assert.equal((await (await upload(bytes)).json()).result,'match');
const mismatch=await (await upload(altered)).json();
assert.equal(mismatch.result,'mismatch');assert.equal(mismatch.message,FILE_MISMATCH_NOTICE);
const {GET}=await import('../app/api/verify/[token]/master/route.ts');
const master=await GET(new Request('https://example.invalid/master'),context);
assert.equal(master.status,200);assert.equal(await sha256Bytes(new Uint8Array(await master.arrayBuffer())),originalHash);
const publicRoute=await import('../app/api/verify/[token]/route.ts');
const record=await (await publicRoute.GET(new Request('https://example.invalid/verify'),context)).json();
assert.equal(record.masterAvailable,true);assert.equal(record.documentSha256,originalHash);assert.equal(record.status,'original');
assert.ok(events.includes('match')&&events.includes('mismatch'));
console.log(JSON.stringify({result:'PASS',checks:['mixed text and Arabic digits','all uploads settled before cleanup','concurrent storage tasks','Final Info/XMP metadata without phone','snapshot identity bound','edited PDF keeps reference but hashes differently','real verify handler rejects edited file','original master download unchanged','master availability and full SHA-256'],localPdfMs:pdfMs,testMs:Math.round(performance.now()-start)}));
