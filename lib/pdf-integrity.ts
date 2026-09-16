import {PDFBool,PDFDict,PDFDocument,PDFHexString,PDFName,PDFString} from 'pdf-lib';
const escapeXml=(value:string)=>value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[character]!));
export function addIntegrityMetadata(pdf:PDFDocument,identity:{reference:string;verificationId:string;version:number;snapshotHash:string;generatedAt:string}){
  const title='إقرار شراء وتسليم منتج رقمي';
  pdf.setTitle(title);
  pdf.setSubject('Final document; integrity verified against registered master SHA-256');
  pdf.setCreator('blontix Order Documentation Platform');
  pdf.setCreationDate(new Date(identity.generatedAt));
  const info=pdf.context.lookup(pdf.context.trailerInfo.Info!,PDFDict);
  for(const [name,value] of Object.entries({DocumentStatus:'Final',DocumentReference:identity.reference,VerificationID:identity.verificationId,ModificationPolicy:'IssueNewVersion',IntegrityMechanism:'MasterSHA256AndVersionedQR'})){
    info.set(PDFName.of(name),PDFHexString.fromText(value));
  }
  info.set(PDFName.of('IntegrityProtected'),PDFBool.True);
  info.set(PDFName.of('DocumentVersion'),PDFString.of(`V${identity.version}`));
  const xml=`<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:bi="urn:blontix:document-integrity:1.0/">
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li></rdf:Alt></dc:title>
<xmp:CreateDate>${escapeXml(identity.generatedAt)}</xmp:CreateDate>
<bi:DocumentStatus>Final</bi:DocumentStatus><bi:DocumentReference>${escapeXml(identity.reference)}</bi:DocumentReference>
<bi:VerificationID>${escapeXml(identity.verificationId)}</bi:VerificationID><bi:DocumentVersion>V${identity.version}</bi:DocumentVersion>
<bi:IntegrityProtected>true</bi:IntegrityProtected><bi:ModificationPolicy>IssueNewVersion</bi:ModificationPolicy>
<bi:IntegrityMechanism>MasterSHA256AndVersionedQR</bi:IntegrityMechanism><bi:SnapshotSHA256>${escapeXml(identity.snapshotHash)}</bi:SnapshotSHA256>
</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
  const stream=pdf.context.stream(new TextEncoder().encode(xml),{Type:'Metadata',Subtype:'XML'});
  pdf.catalog.set(PDFName.of('Metadata'),pdf.context.register(stream));
}
