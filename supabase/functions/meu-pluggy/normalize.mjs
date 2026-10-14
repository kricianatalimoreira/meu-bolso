export function normalizeTransactions(transactions,accountId,month) {
 const records=[];let skipped=0;const seen=new Set();
 for(const t of transactions){
  if(t.status!=='POSTED'||t.currencyCode!=='BRL'||!['DEBIT','CREDIT'].includes(t.type)||typeof t.id!=='string'||!Number.isFinite(t.amount)||t.amount===0){skipped++;continue;}
  let date;
  if(/^\d{4}-\d{2}-\d{2}$/.test(t.date||'')) date=t.date;
  else {const d=new Date(t.date);if(!Number.isFinite(d.getTime())){skipped++;continue;}date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
  if(!date.startsWith(month))continue;
  const sourceId=accountId+':'+t.id;if(seen.has(sourceId))continue;seen.add(sourceId);
  records.push({id:crypto.randomUUID(),name:String(t.description||'Movimentação Nubank').slice(0,80),amount:Math.round(Math.abs(t.amount)*100)/100,type:t.type==='DEBIT'?'expense':'income',date,category:'Outros',paid:false,source:'pluggy',sourceId});
 }
 return {records,skipped};
}
