import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { normalizeTransactions } from './normalize.mjs';
const origin='https://kricianatalimoreira.github.io';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
function response(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});}
async function pluggy(path:string,key:string,body?:unknown){
 const result=await fetch('https://api.pluggy.ai'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(key?{'X-API-KEY':key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(!result.ok)throw Error(result.status===401||result.status===403?'Confira as credenciais e a autorização no Meu Pluggy.':'O Meu Pluggy não respondeu. Tente novamente em alguns minutos.');
 return await result.json();
}
async function authenticatePluggy(c:any){const auth=await pluggy('/auth','',{clientId:c.clientId,clientSecret:c.clientSecret});if(typeof auth.apiKey!=='string')throw Error('Não foi possível conectar ao Meu Pluggy.');return auth.apiKey;}
async function accounts(c:any,key:string){const result=await pluggy('/accounts?itemId='+encodeURIComponent(c.itemId),key);if(!Array.isArray(result.results))throw Error('Não foi possível ler as contas.');return result.results.filter((a:any)=>a.type==='BANK'&&a.currencyCode==='BRL').map((a:any)=>({id:a.id,name:String(a.name||'Conta Nubank'),balance:a.balance,currencyCode:a.currencyCode,type:a.type}));}
Deno.serve(async(req:Request)=>{
 if(req.headers.get('Origin')&&req.headers.get('Origin')!==origin)return response({error:'Origem não permitida.'},403);
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return response({error:'Método não permitido.'},405);
 const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
 if(!token)return response({error:'Entre na sua conta.'},401);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const userClient=createClient(url,anon,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await userClient.auth.getUser(token);
 if(authError||!user)return response({error:'Entre novamente na sua conta.'},401);
 const admin=createClient(url,service,{auth:{persistSession:false}});
 try{
  if(Number(req.headers.get('Content-Length')||0)>10000)return response({error:'Requisição inválida.'},400);
  const body=await req.json();const userId=user.id;
  if(body.action==='configure'){
   const c={clientId:String(body.clientId||'').trim(),clientSecret:String(body.clientSecret||'').trim(),itemId:String(body.itemId||'').trim()};
   if(!c.clientId||c.clientId.length>300||!c.clientSecret||c.clientSecret.length>2000||!/^[-a-f0-9]{36}$/i.test(c.itemId))return response({error:'Preencha o Client ID, Client Secret e Item ID da sua aplicação.'},400);
   const key=await authenticatePluggy(c);const item=await pluggy('/items/'+encodeURIComponent(c.itemId),key);
   if(item.id!==c.itemId)return response({error:'A conexão informada não foi encontrada.'},400);
   const {error}=await admin.rpc('mb_pluggy_store',{p_user:userId,p_credentials:c});if(error)return response({error:'Não foi possível guardar a conexão.'},500);
   await admin.from('meu_bolso_bank_cache').delete().eq('user_id',userId);
   return response({configured:true});
  }
  if(body.action==='disconnect'){const {error}=await admin.rpc('mb_pluggy_unlink',{p_user:userId});if(error)return response({error:'Não foi possível desconectar.'},500);return response({configured:false});}
  const {data:c,error:configError}=await admin.rpc('mb_pluggy_load',{p_user:userId});if(configError)return response({error:'Não foi possível verificar a conexão.'},500);
  if(body.action==='status')return response({configured:Boolean(c)});
  if(!c)return response({error:'Configure sua conexão com o Meu Pluggy.'},409);
  if(body.action==='accounts'){const key=await authenticatePluggy(c);return response({accounts:await accounts(c,key)});}
  if(body.action!=='transactions')return response({error:'Ação inválida.'},400);
  const month=String(body.month||''),accountId=String(body.accountId||'');
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!/^[-a-f0-9]{36}$/i.test(accountId))return response({error:'Escolha uma conta e um mês válido.'},400);
  const {data:cached}=await admin.from('meu_bolso_bank_cache').select('payload,fetched_at').eq('user_id',userId).eq('account_id',accountId).eq('month',month).maybeSingle();
  if(cached&&Date.now()-Date.parse(cached.fetched_at)<3600000)return response({...cached.payload,fetchedAt:cached.fetched_at,cached:true});
  const key=await authenticatePluggy(c);const list=await accounts(c,key);const account=list.find((a:any)=>a.id===accountId);
  if(!account)return response({error:'Essa conta não pertence à conexão configurada.'},403);
  const [year,m]=month.split('-').map(Number);const from=new Date(Date.UTC(year,m-1,0)).toISOString().slice(0,10),to=new Date(Date.UTC(year,m,2)).toISOString().slice(0,10);
  let next='?'+new URLSearchParams({accountId,dateFrom:from,dateTo:to}).toString();const tx:any[]=[];let pages=0;
  while(next){if(++pages>20)throw Error('Há muitas movimentações neste mês. A consulta não foi concluída.');
   if(!next.startsWith('?'))throw Error('A paginação do banco não pôde ser lida.');
   const result=await pluggy('/v2/transactions'+next,key);if(!Array.isArray(result.results))throw Error('As movimentações não puderam ser lidas.');tx.push(...result.results);
   if(result.next){const params=new URLSearchParams(result.next);params.set('accountId',accountId);params.set('dateFrom',from);params.set('dateTo',to);next='?'+params.toString();}else next='';
  }
  const payload={...normalizeTransactions(tx,accountId,month),account};const fetchedAt=new Date().toISOString();
  const {error:cacheError}=await admin.from('meu_bolso_bank_cache').upsert({user_id:userId,account_id:accountId,month,payload,fetched_at:fetchedAt});
  if(cacheError)return response({error:'Não foi possível guardar as movimentações. Tente novamente.'},500);
  return response({...payload,fetchedAt,cached:false});
 }catch(error){return response({error:error instanceof Error?error.message:'Não foi possível conectar ao banco.'},400);}
});
