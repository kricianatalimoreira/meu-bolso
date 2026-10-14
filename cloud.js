/* Configuração pública: use apenas a chave publishable, nunca service_role. */
let cloudClient, cloudUser, cloudRevision = 0, cloudReady = false;
async function startCloud() {
  document.querySelector('nav').hidden = true;
  if (!window.MEU_BOLSO_CONFIG?.url || !window.MEU_BOLSO_CONFIG?.key || !window.supabase) {
    document.querySelector('#content').innerHTML = '<div class="empty">A conexão com sua conta está sendo preparada.</div>';
    return;
  }
  cloudClient = window.supabase.createClient(MEU_BOLSO_CONFIG.url, MEU_BOLSO_CONFIG.key);
  const { data, error } = await cloudClient.auth.getSession();
  if (error) { authScreen('Não foi possível verificar seu acesso. Entre novamente.'); return; }
  if (data.session) await loadCloud(data.session.user); else authScreen();
  cloudClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') { cloudReady = false; cloudUser = null; state = {records:[],budget:0}; authScreen(); }
    if (event === 'SIGNED_IN' && session && (!cloudUser || cloudUser.id !== session.user.id)) {
      setTimeout(() => loadCloud(session.user), 0);
    }
  });
}
function authScreen(message = '') {
  cloudReady = false;
  document.querySelector('.month').hidden = true;
  document.querySelector('#backup').hidden = true;
  document.querySelector('.privacy').textContent = '♡ Acesse sua conta para guardar seus registros com segurança.';
  document.querySelector('#logout')?.remove();
  document.querySelector('nav').hidden = true;
  document.querySelector('#content').innerHTML = `<div class="balance"><span class="caption">SUAS FINANÇAS, SEMPRE COM VOCÊ</span><h2 style="font-size:26px">Um bolso mais leve ♡</h2><small>Entre para acessar seus registros em qualquer aparelho.</small></div><form id="auth-form" class="card" style="margin-top:18px"><h2>Acesse sua conta</h2><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Senha<input name="password" type="password" minlength="8" autocomplete="current-password" required></label><button class="primary" id="login" type="submit">Entrar</button><button class="link" id="signup" type="button" style="width:100%;margin-top:16px">Criar minha conta</button><p id="auth-message" class="caption" role="status" style="line-height:1.7"></p></form>`;
  document.querySelector('#auth-message').textContent = message;
  document.querySelector('#auth-form').onsubmit = e => { e.preventDefault(); authenticate(false); };
  document.querySelector('#signup').onclick = () => authenticate(true);
}
async function authenticate(signup) {
  const form = document.querySelector('#auth-form');
  if (!form.reportValidity()) return;
  const message = document.querySelector('#auth-message');
  form.querySelectorAll('button').forEach(b => b.disabled = true);
  try {
    const args = {email: form.elements.email.value.trim(), password: form.elements.password.value};
    const result = signup ? await cloudClient.auth.signUp({...args,options:{emailRedirectTo:location.origin+location.pathname}}) : await cloudClient.auth.signInWithPassword(args);
    if (result.error) { message.textContent = result.error.code === 'invalid_credentials' ? 'Confira seu e-mail e senha.' : result.error.code === 'email_not_confirmed' ? 'Confirme seu e-mail antes de entrar.' : 'Não foi possível entrar: '+result.error.message; return; }
    if (result.data.session) await loadCloud(result.data.session.user);
    else message.textContent = 'Confira seu e-mail para confirmar a conta. Depois, volte e entre com sua senha.';
  } catch { message.textContent = 'Não foi possível conectar. Verifique sua internet e tente novamente.'; }
  finally { if (form.isConnected) form.querySelectorAll('button').forEach(b => b.disabled = false); }
}
async function loadCloud(user) {
  cloudReady = false;
  cloudUser = user;
  document.querySelector('#content').innerHTML = '<div class="empty">Carregando seu bolso…</div>';
  try {
    const {data,error} = await cloudClient.from('meu_bolso_state').select('data,revision').eq('user_id',user.id).maybeSingle();
    if (error) throw error;
    state = data?.data || {records:[],budget:0};
    cloudRevision = data?.revision || 0;
    cloudReady = true;
    document.querySelector('nav').hidden = false;
    document.querySelector('.month').hidden = false;
    document.querySelector('#backup').hidden = false;
    document.querySelector('.privacy').textContent = '♡ Dados salvos na sua conta. Acesse de qualquer aparelho.';
    render();
    if (!document.querySelector('#logout')) {
      const b = document.createElement('button'); b.id='logout'; b.className='link'; b.textContent='Sair';
      b.onclick=async()=>{ const {error}=await cloudClient.auth.signOut(); if(error)toast('Não foi possível sair. Tente novamente.'); else b.remove(); };
      document.querySelector('header').append(b);
    }
  } catch { authScreen('Não foi possível carregar seus dados. Tente entrar novamente.'); cloudUser = null; }
}
let saving = false;
async function save() {
  if (!cloudReady || !cloudUser || saving) { toast('Aguarde a conexão com sua conta.'); return false; }
  saving = true;
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try {
    const payload = JSON.parse(JSON.stringify(state));
    let result;
    if (cloudRevision === 0) result = await cloudClient.from('meu_bolso_state').insert({user_id:cloudUser.id,data:payload,revision:1}).select('revision').single();
    else result = await cloudClient.from('meu_bolso_state').update({data:payload,revision:cloudRevision+1}).eq('user_id',cloudUser.id).eq('revision',cloudRevision).select('revision').maybeSingle();
    if (result.error || !result.data) throw result.error || Error('conflict');
    cloudRevision = result.data.revision;
    return true;
  } catch {
    await loadCloud(cloudUser);
    toast('A alteração não foi salva. Seus dados foram recarregados; tente novamente.');
    return false;
  } finally { saving=false; document.querySelectorAll('button').forEach(b=>b.disabled=false); }
}
startCloud();
