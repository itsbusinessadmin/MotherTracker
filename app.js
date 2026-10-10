(function(){
  'use strict';
  var CFG=window.CE_CONFIG||{};
  var PAGE_ID=CFG.pageId||'main';
  var CACHE_KEY='ce-links:'+PAGE_ID;
  var CODE_KEY='ce-edit-code:'+PAGE_ID;
  var DEFAULT={name:'CE Fun Club Store',logo:'',links:[{id:'l1',title:'Order online',url:'https://bilihan.shop',img:'',admin:'https://bilihan.shop/admin.html'}]};

  var configured=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey&&!/^YOUR_/.test(CFG.supabaseUrl)&&window.supabase);
  var sb=configured?window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;

  // saved = last state known to be in the cloud (or on this device in local mode); state = what's on screen
  var cached=readCache();
  var saved=cached?cached.data:clone(DEFAULT);
  var version=cached?cached.version:null;
  var state=clone(saved);
  var code=readCode(), editing=false, dirty=false, saving=false, uploading=false;
  var msg='', sheet=null, choose=null, unlock=null, sync=configured?'loading':'local', staleRemote=false;
  var root=document.getElementById('root');

  function clone(o){return JSON.parse(JSON.stringify(o))}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function host(u){try{return new URL(u).hostname.replace(/^www\./,'')}catch(e){return ''}}
  function normUrl(u){u=u.trim();if(!u)return '';if(!/^[a-z][a-z0-9+.-]*:/i.test(u))u='https://'+u;return u}
  function safeHref(u){return /^https?:\/\//i.test(u||'')?u:'#'}
  function safeImg(u){return /^(https?:\/\/|data:image\/)/i.test(u||'')?u:''}
  function initials(n){return (n||'CE').split(/\s+/).filter(Boolean).slice(0,2).map(function(w){return w[0]}).join('').toUpperCase()}
  function pick(r){return {name:r.name||DEFAULT.name,logo:r.logo||'',links:Array.isArray(r.links)?r.links:[]}}

  function readCache(){try{var c=JSON.parse(localStorage.getItem(CACHE_KEY));return c&&c.data?c:null}catch(e){return null}}
  function writeCache(){try{localStorage.setItem(CACHE_KEY,JSON.stringify({data:saved,version:version}))}catch(e){}}
  function readCode(){try{return localStorage.getItem(CODE_KEY)||''}catch(e){return ''}}
  function rememberCode(c){try{if(c)localStorage.setItem(CODE_KEY,c);else localStorage.removeItem(CODE_KEY)}catch(e){}}

  // ── Rendering ──────────────────────────────────────────────────────────
  function render(){
    var logo=safeImg(state.logo);
    var badge='<div class="badge" aria-hidden="true">'+(logo?'<img src="'+esc(logo)+'" alt="">':esc(initials(state.name)))+'</div>';
    var hasBar=editing||!!msg;
    var h='<div class="wrap'+(editing?' editing':'')+(hasBar?' hasbar':'')+'"><header>';
    if(editing){
      h+='<div class="logo-edit"><label class="logo-pick">'+badge+(uploading==='logo'?'Loading…':state.logo?'Change logo':'Upload logo')+
         '<input type="file" id="f-logo" accept="image/*"></label>'+
         (state.logo?'<button type="button" class="linkbtn" id="rm-logo">Remove logo</button>':'')+'</div>';
      h+='<label style="width:100%">Page name<input type="text" id="f-name" value="'+esc(state.name)+'"></label>';
    }else{
      h+=badge+'<h1>'+esc(state.name)+'</h1>';
    }
    h+='</header>';
    if(editing&&!configured)h+='<p class="notice">Not connected to Supabase yet — changes are saved on this device only. See README to turn on cloud sync.</p>';
    h+='<nav class="grid" aria-label="Links">';
    if(!state.links.length&&!editing)h+='<p class="empty">No links yet.</p>';
    state.links.forEach(function(l,i){
      var img=safeImg(l.img);
      var ph='<div class="ph">'+(img?'<img src="'+esc(img)+'" alt="">':'<div class="initial">'+esc((l.title||'?')[0].toUpperCase())+'</div>')+'</div>';
      var lb='<div class="lbl">'+esc(l.title)+(editing?'<span class="host">'+esc(host(l.url))+(l.admin?' · + admin link':'')+'</span>':'')+'</div>';
      if(editing)h+='<button class="tile addtile" data-edit="'+i+'" aria-label="Edit '+esc(l.title)+'">'+ph+lb+'</button>';
      else if(l.admin)h+='<button type="button" class="tile tbtn" data-choose="'+i+'" aria-haspopup="dialog">'+ph+lb+'</button>';
      else h+='<a class="tile" href="'+esc(safeHref(l.url))+'" target="_blank" rel="noopener">'+ph+lb+'</a>';
    });
    if(editing)h+='<button class="tile addtile" id="add" aria-label="Add a link"><div class="ph">+</div><div class="lbl">Add link</div></button>';
    h+='</nav><footer>Powered by <b>Ganda</b>';
    if(!editing)h+='<div class="footer-actions"><button type="button" class="linkbtn" id="edit">Edit links</button></div>';
    h+='</footer></div>';
    if(hasBar)h+=barHTML();
    if(sheet)h+=sheetHTML();
    else if(unlock)h+=unlockHTML();
    else if(choose!=null&&state.links[choose])h+=chooserHTML(state.links[choose]);
    root.innerHTML=h;
    wire();
  }

  function barHTML(){
    var h='<div class="bar">';
    if(editing){
      h+='<span class="msg">'+esc(msg||(dirty?'Unsaved changes':'Tap a tile to edit it'))+'</span>'+
         '<button class="btn" id="done">'+(dirty?'Discard':'Done')+'</button>'+
         '<button class="btn primary" id="save"'+(dirty&&!saving&&!uploading?'':' disabled')+'>'+(saving?'Saving…':'Save changes')+'</button>';
    }else{
      h+='<span class="msg">'+esc(msg)+'</span>';
    }
    return h+'</div>';
  }

  var ICON_SHOP='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v1.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v7h14v-7"/><path d="M10 20v-4h4v4"/></svg>';
  var ICON_ADMIN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
  function chooserHTML(l){
    return '<div class="sheet" id="chooser"><div class="panel" role="dialog" aria-modal="true" aria-labelledby="ch-t"><h2 id="ch-t">'+esc(l.title)+'</h2>'+
      '<div class="choices"><a class="choice" href="'+esc(safeHref(l.url))+'" target="_blank" rel="noopener" data-close>'+ICON_SHOP+'Customer page</a>'+
      '<a class="choice" href="'+esc(safeHref(l.admin))+'" target="_blank" rel="noopener" data-close>'+ICON_ADMIN+'Admin</a></div>'+
      '<div class="row"><span></span><button type="button" class="btn" id="ch-cancel">Cancel</button></div></div></div>';
  }

  function sheetHTML(){
    var l=sheet.link, img=safeImg(l.img);
    return '<div class="sheet" id="sheet"><form class="panel" id="lform" novalidate><h2>'+(sheet.index<0?'Add a link':'Edit link')+'</h2>'+
      '<div class="photo"><div class="prev" id="prev">'+(uploading==='tile'?'Loading…':img?'<img src="'+esc(img)+'" alt="">':'No photo')+'</div>'+
      '<label style="flex:1">Photo or icon<input type="file" id="f-img" accept="image/*"></label></div>'+
      '<label>Name<input type="text" id="f-title" value="'+esc(l.title)+'" placeholder="e.g. Facebook Page" required></label>'+
      '<label>Customer page link<input type="url" id="f-url" value="'+esc(l.url)+'" placeholder="https://…" inputmode="url"></label>'+
      '<label>Admin link (optional)<input type="url" id="f-admin" value="'+esc(l.admin||'')+'" placeholder="https://…/admin" inputmode="url"><span class="hint">With an admin link, tapping the photo asks: Customer page or Admin. Without one, it opens the customer page directly.</span></label>'+
      (sheet.err?'<p class="err">'+esc(sheet.err)+'</p>':'')+
      '<div class="row"><div>'+(sheet.index>=0?'<button type="button" class="btn danger" id="del">'+(sheet.confirmDel?'Tap again to delete':'Delete')+'</button>':'')+
      (sheet.index>0?' <button type="button" class="btn" id="up" aria-label="Move earlier">↑</button>':'')+'</div>'+
      '<div class="right"><button type="button" class="btn" id="cancel">Cancel</button><button type="submit" class="btn primary"'+(uploading?' disabled':'')+'>'+(sheet.index<0?'Add':'Update')+'</button></div></div>'+
      '</form></div>';
  }

  function unlockHTML(){
    return '<div class="sheet" id="usheet"><form class="panel" id="uform" novalidate><h2>Edit links</h2>'+
      '<p>Enter the edit code to change this page.</p>'+
      '<label>Edit code<input type="password" id="f-code" value="'+esc(unlock.code||'')+'" autocomplete="current-password" autocapitalize="off" required></label>'+
      '<label style="flex-direction:row;align-items:center;gap:8px;font-weight:500"><input type="checkbox" id="f-remember"'+(unlock.remember?' checked':'')+'>Remember on this device</label>'+
      (unlock.err?'<p class="err">'+esc(unlock.err)+'</p>':'')+
      '<div class="row"><span></span><div class="right"><button type="button" class="btn" id="u-cancel">Cancel</button>'+
      '<button type="submit" class="btn primary"'+(unlock.busy?' disabled':'')+'>'+(unlock.busy?'Checking…':'Continue')+'</button></div></div></form></div>';
  }

  // ── Events ─────────────────────────────────────────────────────────────
  function $(id){return document.getElementById(id)}
  function on(id,ev,fn){var e=$(id);if(e)e.addEventListener(ev,fn)}

  function readSheetFields(){
    if(!sheet)return;
    if($('f-title'))sheet.link.title=$('f-title').value;
    if($('f-url'))sheet.link.url=$('f-url').value;
    if($('f-admin'))sheet.link.admin=$('f-admin').value;
  }
  function readHeader(){
    if($('f-name')){var n=$('f-name').value.trim()||DEFAULT.name;if(n!==state.name){state.name=n;dirty=true}}
  }

  function wire(){
    on('edit','click',startEditing);
    root.querySelectorAll('[data-choose]').forEach(function(b){b.addEventListener('click',function(){
      choose=+b.getAttribute('data-choose');render();var c=root.querySelector('.choice');if(c)c.focus()})});
    if(choose!=null){
      var closeCh=function(){choose=null;render()};
      on('ch-cancel','click',closeCh);
      on('chooser','click',function(e){if(e.target.id==='chooser')closeCh()});
      root.querySelectorAll('[data-close]').forEach(function(a){a.addEventListener('click',function(){setTimeout(closeCh,0)})});
    }
    if(unlock){
      var closeU=function(){unlock=null;render()};
      on('u-cancel','click',closeU);
      on('usheet','click',function(e){if(e.target.id==='usheet')closeU()});
      on('uform','submit',function(e){e.preventDefault();tryCode($('f-code').value.trim(),$('f-remember').checked)});
    }
    on('done','click',function(){
      if(dirty||staleRemote){state=clone(saved);if(staleRemote)refresh()}
      editing=false;dirty=false;msg='';render()});
    on('save','click',save);
    on('f-name','change',function(){readHeader();render()});
    on('f-logo','change',function(e){
      var f=e.target.files&&e.target.files[0];if(!f)return;readHeader();
      uploading='logo';msg='';render();
      storeImage(f).then(function(u){uploading=false;state.logo=u;dirty=true;render()})
        .catch(function(err){uploading=false;msg=imgError(err);render()});
    });
    on('rm-logo','click',function(){readHeader();state.logo='';dirty=true;render()});
    on('add','click',function(){readHeader();sheet={index:-1,link:{id:'l'+Date.now(),title:'',url:'',img:''}};render();$('f-title').focus()});
    root.querySelectorAll('[data-edit]').forEach(function(b){b.addEventListener('click',function(){
      readHeader();var i=+b.getAttribute('data-edit');sheet={index:i,link:Object.assign({},state.links[i])};render();$('f-title').focus()})});
    if(!sheet)return;
    on('sheet','click',function(e){if(e.target.id==='sheet'&&!uploading){sheet=null;render()}});
    on('cancel','click',function(){sheet=null;uploading=false;render()});
    on('f-img','change',function(e){
      var f=e.target.files&&e.target.files[0];if(!f)return;readSheetFields();
      var s=sheet;uploading='tile';s.err='';render();
      storeImage(f).then(function(u){uploading=false;s.link.img=u;if(sheet===s)render()})
        .catch(function(err){uploading=false;s.err=imgError(err);if(sheet===s)render()});
    });
    on('del','click',function(){
      if(!sheet.confirmDel){readSheetFields();sheet.confirmDel=true;render();return}
      state.links.splice(sheet.index,1);dirty=true;sheet=null;render()});
    on('up','click',function(){
      var i=sheet.index;var a=state.links;var t=a[i-1];a[i-1]=a[i];a[i]=t;dirty=true;sheet=null;render()});
    on('lform','submit',function(e){
      e.preventDefault();if(uploading)return;readSheetFields();
      var l=sheet.link;l.title=l.title.trim();l.url=normUrl(l.url);
      if(!l.title){sheet.err='Add a name for this link.';render();return}
      if(!l.url||!/^https?:\/\//i.test(l.url)){sheet.err='Add the customer page link, starting with https://';render();return}
      l.admin=normUrl(l.admin||'');
      if(l.admin&&!/^https?:\/\//i.test(l.admin)){sheet.err='The admin link should start with https://';render();return}
      if(sheet.index<0)state.links.push(l);else state.links[sheet.index]=l;
      dirty=true;sheet=null;render();
    });
  }

  // ── Images: square-crop and shrink ─────────────────────────────────────
  function shrink(file){
    return new Promise(function(res,rej){
      var r=new FileReader();r.onerror=rej;r.onload=function(){
        var img=new Image();img.onerror=rej;img.onload=function(){
          var S=360,c=document.createElement('canvas');c.width=S;c.height=S;
          var s=Math.min(img.width,img.height),sx=(img.width-s)/2,sy=(img.height-s)/2;
          var x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,S,S);x.drawImage(img,sx,sy,s,s,0,0,S,S);
          res(c);
        };img.src=r.result;
      };r.readAsDataURL(file);
    });
  }
  function storeImage(file){
    // Photos are saved with the page as small JPEG data, so editing needs no upload permissions.
    return shrink(file).then(function(c){return c.toDataURL('image/jpeg',0.8)});
  }
  function imgError(){return 'That image could not be read. Try a JPG or PNG.'}

  // ── Cloud sync ─────────────────────────────────────────────────────────
  function applyRow(row){
    saved=pick(row);version=row.version;writeCache();
    if(!dirty){state=clone(saved);staleRemote=false}else staleRemote=true;
  }

  function refresh(){
    if(!sb)return Promise.resolve();
    return sb.from('ce_link_pages').select('*').eq('id',PAGE_ID).maybeSingle().then(function(r){
      if(r.error){sync='offline';render();return}
      sync='live';
      if(r.data&&r.data.version!==version)applyRow(r.data);
      else if(!r.data)version=null;
      render();
    },function(){sync='offline';render()});
  }

  var CODE_MSG={bad_code:'That edit code is not right.',locked:'Too many wrong codes. Wait 15 minutes and try again.',
    no_code:'No edit code has been set up yet. See the README.'};

  function startEditing(){
    choose=null;msg='';
    if(!sb||code){editing=true;render();return}
    unlock={code:'',remember:true};render();$('f-code').focus();
  }

  function tryCode(c,remember){
    if(!c){unlock.err='Enter the edit code.';render();return}
    unlock={code:c,remember:remember,busy:true};render();
    sb.rpc('ce_check_code',{p_page:PAGE_ID,p_code:c}).then(function(r){
      if(!unlock)return;
      if(r.error){unlock.busy=false;unlock.err='Could not check the code. Check your connection and try again.';render();return}
      if(r.data!=='ok'){unlock.busy=false;unlock.err=CODE_MSG[r.data]||'Could not check the code.';render();return}
      code=c;if(remember)rememberCode(c);
      unlock=null;editing=true;render();
    },function(){if(unlock){unlock.busy=false;unlock.err='Could not check the code. Check your connection and try again.';render()}});
  }

  function save(){
    readHeader();
    if(saving||uploading||!dirty)return;
    if(!sb){
      saved=clone(state);writeCache();dirty=false;editing=false;flash('Saved on this device');return;
    }
    if(staleRemote){msg='This page changed on another device. Tap Discard to load it, then make your change again.';render();return}
    saving=true;msg='';render();
    sb.rpc('ce_save_page',{p_page:PAGE_ID,p_code:code,p_version:version,p_name:state.name,p_logo:state.logo||'',p_links:state.links}).then(function(r){
      saving=false;
      var st=r.data&&r.data.status;
      if(r.error||!st){msg='Could not save. Check your connection and tap Save again.';render();return}
      if(st==='ok'){dirty=false;applyRow(r.data.row);editing=false;sync='live';flash('Saved');return}
      if(st==='conflict'){
        msg='This page changed on another device. Tap Discard to load it, then make your change again.';
        staleRemote=true;refresh();return;
      }
      if(st==='bad_code'||st==='no_code'){
        // Code was changed or never set: forget it and ask again, keeping the unsaved edits
        code='';rememberCode('');msg='';unlock={code:'',remember:true,err:CODE_MSG[st]};render();return;
      }
      msg=CODE_MSG[st]||(st==='too_large'?'Too many photos to save. Remove a few and try again.':'Could not save. Try again.');
      render();
    },function(){saving=false;msg='Could not save. Check your connection and tap Save again.';render()});
  }

  function flash(t){
    msg=t;render();
    setTimeout(function(){if(msg===t){msg='';render()}},2500);
  }

  function startSync(){
    sb.channel('link-page-'+PAGE_ID)
      .on('postgres_changes',{event:'*',schema:'public',table:'ce_link_pages',filter:'id=eq.'+PAGE_ID},function(p){
        // Fetch rather than trust the payload: rows with photos can be too big to arrive whole
        if(!p.new||p.new.version==null||version==null||p.new.version>version)refresh();
      })
      .subscribe(function(status){
        if(status==='SUBSCRIBED'){refresh()}
        else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){sync='offline';render()}
      });
    refresh();
    document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh()});
    window.addEventListener('online',refresh);
    window.addEventListener('offline',function(){sync='offline';render()});
  }

  window.addEventListener('beforeunload',function(e){if(dirty){e.preventDefault();e.returnValue=''}});

  render();
  if(sb)startSync();
  if('serviceWorker' in navigator&&location.protocol!=='file:'){
    window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});
  }
})();
