import {
 PRODUCTS,STAFF,FACILITIES,WH,initialState,isValidState,product,facility,labelLocation,staffLocation,
 qty,binLots,available,reserved,daysSince,agedHoldings,issues,totals,priceFor,exportTables,
 outbound,checkout,handoffRequest,handoffConfirm,cancelHandoff,returnRequest,returnConfirm,
 createOrder,receiveOrder,checkOrder,billDelivery,changePrice
} from "./core.js?v=2";

const KEY="minpakuos-stockflow-v2-public-sample";
const APP=document.getElementById("app");
let db;
try{const stored=JSON.parse(localStorage.getItem(KEY)||"null");db=isValidState(stored)?stored:initialState()}catch{db=initialState()}
let active="field",staff="A",mode="delivery",tableKey="担当者保管在庫",formSKU="TB",formFAC="X";
let toastTimer=null;let modalAction=null;let scrollOnRender=false;
const yen=n=>"¥"+Math.round(n).toLocaleString("ja-JP");
const nf=n=>Number(n||0).toLocaleString("ja-JP");
const fmt=d=>new Date(d).toLocaleString("ja-JP",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
const esc=x=>String(x??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[s]));
const options=(arr,selected)=>arr.map(a=>'<option value="'+esc(a.value)+'"'+(String(a.value)===String(selected)?" selected":"")+'>'+esc(a.label)+'</option>').join("");
const productOpt=(selected)=>options(PRODUCTS.map(p=>({label:p.name,value:p.id})),selected);
const facilityOpt=(selected)=>options(FACILITIES.map(f=>({label:f.name,value:f.id})),selected);
const staffOpt=(selected,excluded)=>options(STAFF.filter(s=>s!==excluded).map(s=>({label:"スタッフ"+s,value:s})),selected);
const btn=(label,action,kind="secondary",tiny=true)=>'<button class="btn '+kind+(tiny?" tiny":"")+'" data-act="'+action+'">'+label+'</button>';
const status=(label,type="blue")=>'<span class="tag '+type+'">'+esc(label)+'</span>';
const totalStock=(s)=>PRODUCTS.reduce((sum,p)=>sum+qty(db,staffLocation(s),p.id),0);
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(db))}
  catch(e){showToast("保存できません。ストレージ設定を確認してください",true)}
}
function showToast(message,error=false){
  document.getElementById("demo-toast")?.remove();
  const div=document.createElement("div");div.id="demo-toast";div.className="toast"+(error?" error":"");
  div.textContent=message;document.body.append(div);
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>div.remove(),3300);
}
function sectionHead(title,subtitle){
 return '<div class="section-top"><div><h2>'+title+'</h2><div class="section-sub">'+subtitle+'</div></div></div>';
}
function head(){
 const t=totals(db);
 const tabs=[["field","現場操作","📱"],["warehouse","発注・倉庫","📦"],["account","経理・照合","🧾"],["ledger","管理台帳","▦"]];
 return '<div class="topbar"><div class="topbar-inner"><div class="brand"><div class="logo">S</div><div><div class="brand-title">minpakuOS <span style="font-weight:550;color:#688ca7">/ StockFlow</span></div><div class="brand-sub">PROCUREMENT · CUSTODY · BILLING</div></div></div><div class="top-actions"><span class="pill"><i class="dot"></i>公開デモ</span><button class="icon-btn" data-act="reset" title="デモ初期化" aria-label="デモ初期化">↺</button></div></div></div>'+
 '<main class="page"><div class="hero"><div><div class="eyebrow">SHAKEHANDS OPERATIONS / DEMO V2</div><h1>仕入から請求まで、ひとつにつながる。</h1><p class="lead">倉庫 → スタッフの車載在庫 → 施設納品 → 請求。<br>担当者・数量・原価・請求金額を取引IDで追跡する業務デモです。</p></div><div class="hero-side"><span class="hero-note">実在庫・実単価は使用していません</span><div class="caption">ブラウザ内でのみデータを保持 / LINE・Google Sheets未接続</div></div></div>'+
 '<nav class="nav" aria-label="機能切替">'+tabs.map(x=>'<button data-tab="'+x[0]+'" class="'+(active===x[0]?"active":"")+'">'+x[2]+' '+x[1]+(x[0]==="account"&&t.issues?'<span class="num">'+t.issues+'</span>':"")+'</button>').join("")+'</nav>';
}
function foot(){
 const tabs=[["field","現場","📱"],["warehouse","倉庫","📦"],["account","経理","🧾"],["ledger","台帳","▦"]];
 return '<div class="footer">minpakuOS StockFlow V2 — 動作検証専用<br>架空データ・端末内保存・外部送信なし。実際のLINE認証／Sheets連携／請求発行は未実装です。</div></main>'+
 '<div class="mobile-nav" aria-label="画面切替">'+tabs.map(t=>'<button data-tab="'+t[0]+'" class="'+(active===t[0]?"active":"")+'"><span>'+t[2]+'</span>'+t[1]+'</button>').join("")+'</div>';
}
function metrics(items){
 return '<div class="metrics">'+items.map(m=>'<div class="metric '+(m.type||"")+'"><div class="label">'+m.label+'</div><div class="value">'+m.value+'</div><div class="foot">'+(m.note||"&nbsp;")+'</div></div>').join("")+'</div>';
}
function fieldView(){
 const t=totals(db);
 const rows=PRODUCTS.filter(p=>qty(db,staffLocation(staff),p.id)>0).map(p=>{
  const n=qty(db,staffLocation(staff),p.id),held=reserved(db,staff,p.id);
  const aged=Math.max(0,...binLots(db,staffLocation(staff),p.id).map(x=>daysSince(x.custodySince||x.receivedAt)));
  return '<div class="stock-row"><div class="row-main"><div><div class="row-title">'+p.name+' '+(aged>=7?status(aged+"日保管","amber"):"")+'</div><div class="row-sub">使用可能 '+nf(n-held)+p.unit+(held?" / 引渡・返却予約 "+nf(held)+p.unit:"")+'</div></div><div class="row-value">'+nf(n)+'<small> '+p.unit+'</small></div></div></div>';
 }).join("")||'<div class="listempty">現在、預かり在庫はありません。<br>「出庫」から倉庫の商品を受け取ってください。</div>';
 const pending=db.transfers.filter(h=>h.to===staff && (h.status==="pending"||h.status==="discrepancy"));
 const recent=db.movements.filter(m=>m.from===staffLocation(staff)||m.to===staffLocation(staff)).slice(0,4);
 return sectionHead("現場スタッフ用","原価・販売単価は非表示。出庫と納品を少ない操作で登録できます。")+
 '<div class="role-bar"><div><div class="role-label">● デモ操作担当者</div><div class="hint">本番はLINEログインで自動設定</div></div><select class="role-select" id="staff-select">'+staffOpt(staff)+'</select></div>'+
 metrics([{label:"自分の保管商品",value:PRODUCTS.filter(p=>qty(db,staffLocation(staff),p.id)>0).length+"種類",note:"車載・持ち回り在庫"},
          {label:"自分の施設納品",value:db.deliveries.filter(d=>d.holder===staff).length+"件",note:"納品済みの明細"},
          {label:"出庫可能商品",value:PRODUCTS.filter(p=>available(db,staff,p.id)>0).length+"種類",note:"受渡予約分を除外"},
          {label:"受領待ち",value:pending.length+"件",note:"他スタッフからの引渡し"}])+
 '<div class="layout"><div class="stack">'+
 '<div class="card"><div class="card-head"><h2>① スマホで登録する</h2>'+status("入力 → 確認 → 確定","green")+'</div><div class="card-inner">'+
 '<div class="action-tabs"><button class="action-tab '+(mode==="delivery"?"on":"")+'" data-mode="delivery">🏠 施設へ納品<span>手元在庫 → 施設</span></button><button class="action-tab '+(mode==="outbound"?"on":"")+'" data-mode="outbound">📦 倉庫から出庫<span>倉庫 → 自分の車載在庫</span></button></div>'+
 '<div class="field"><label>商品</label><select id="field-sku">'+productOpt(formSKU)+'</select></div>'+
 (mode==="delivery"?'<div class="field"><label>納品先施設</label><select id="field-fac">'+facilityOpt(formFAC)+'</select></div>':'<div class="field"><label>出庫元倉庫</label><div class="selected-stock"><span>倉庫</span><strong>デモ名護倉庫</strong></div></div>')+
 '<div class="field"><label>数量</label><input type="number" inputmode="numeric" min="1" step="1" value="20" id="field-qty"><small>商品・数量は確認画面で再確認できます。</small></div>'+
 '<div id="field-availability" class="selected-stock"></div>'+
 '<button class="btn full" data-act="field-submit">内容を確認する →</button></div></div>'+
 '<div class="card"><div class="card-head"><h2>② その他の操作</h2><span class="minor">必要な場合のみ</span></div><div class="card-inner"><div class="small-actions"><button class="secondary-action" data-act="handoff">⇄ 他スタッフへ引渡す</button><button class="secondary-action" data-act="receive-handoff">✓ 受領を確認する '+(pending.length?status(pending.length+"件","amber"):"")+'</button><button class="secondary-action" data-act="return">↩ 倉庫へ返却する</button><button class="secondary-action" data-act="show-history">≡ 自分の移動履歴</button></div></div></div>'+
 '</div><div class="stack">'+
 '<div class="card"><div class="card-head"><h2>スタッフ'+staff+' の保管在庫</h2>'+status("個人別に記録","blue")+'</div><div class="card-inner">'+rows+'</div></div>'+
 '<div class="card"><div class="card-head"><h2>最近の在庫移動</h2><span class="minor">担当者：'+staff+'</span></div><div class="card-inner">'+(recent.map(m=>'<div class="history-row"><div class="row-main"><div><div class="row-title">'+labelLocation(m.from)+' → '+labelLocation(m.to)+'</div><div class="row-sub">'+product(m.sku).name+' / '+fmt(m.at)+'</div></div><div class="row-value">'+nf(m.qty)+' <small>'+product(m.sku).unit+'</small></div></div></div>').join("")||'<div class="listempty">まだ移動はありません。</div>')+'</div></div>'+
 '<div class="note">💡 スタッフから他スタッフへの引渡しは、受取側の確認が終わるまで移動しません。出庫可能数量からは予約分が差し引かれます。</div>'+
 '</div></div>';
}
function warehouseView(){
 const open=db.purchaseOrders.filter(o=>o.status==="ordered");
 const received=db.purchaseOrders.filter(o=>o.status==="received"&&!o.checked);
 const returnWait=db.returns.filter(r=>r.status==="pending");
 return sectionHead("仕入・倉庫管理","発注と検品を記録し、仕入時点の単価を保存します。")+
 metrics([{label:"入荷待ちの発注",value:open.length+"件",note:"発注済み"},
          {label:"仕入照合待ち",value:received.length+"件",note:"数量・単価の確認"},
          {label:"倉庫の商品種類",value:PRODUCTS.filter(p=>qty(db,WH,p.id)>0).length+"種類",note:"デモ名護倉庫"},
          {label:"返却受領待ち",value:returnWait.length+"件",note:"スタッフから倉庫へ"}])+
 '<div class="layout"><div class="stack">'+
 '<div class="card"><div class="card-head"><h2>新規発注</h2>'+status("仕入担当者","blue")+'</div><div class="card-inner">'+
 '<div class="field"><label>商品</label><select id="order-sku">'+productOpt("BT")+'</select></div>'+
 '<div class="field-row"><div class="field"><label>発注数量</label><input id="order-qty" type="number" min="1" step="1" inputmode="numeric" value="50"></div><div class="field"><label>予定仕入単価（税抜・円）</label><input id="order-cost" type="number" min="0" step="1" inputmode="numeric" value="15"></div></div>'+
 '<button class="btn full" data-act="order-create">発注を登録する</button></div></div>'+
 '<div class="card"><div class="card-head"><h2>発注・入荷・検品</h2><span class="minor">価格差異も記録</span></div><div class="card-inner">'+
 (db.purchaseOrders.length?db.purchaseOrders.slice(0,15).map(o=>{
   const hasDiff=o.status==="received" && (o.actualQty!==o.qty||o.actualCost!==o.plannedCost);
   const st=o.status==="ordered"?status("入荷待ち","blue"):o.checked?status("経理照合済","green"):status(hasDiff?"差異あり":"照合待ち",hasDiff?"amber":"blue");
   return '<div class="invoice-row"><div class="row-main"><div><div class="row-title">'+esc(o.id)+' / '+product(o.sku).name+'</div><div class="row-sub">発注 '+nf(o.qty)+product(o.sku).unit+' × '+yen(o.plannedCost)+' / 合計 '+yen(o.qty*o.plannedCost)+'</div></div>'+st+'</div>'+
  (o.status==="received"?'<div class="row-sub">実入荷：'+nf(o.actualQty)+product(o.sku).unit+' × '+yen(o.actualCost)+' / 実仕入合計 '+yen(o.actualQty*o.actualCost)+'</div>':'')+
   (o.status==="ordered"?'<div style="margin-top:10px">'+btn("入荷を登録","receive-order:"+o.id,"secondary")+'</div>':'')+
   '</div>'}).join(""):'<div class="listempty">まだ発注がありません。</div>')+
 '</div></div></div><div class="stack">'+
 '<div class="card"><div class="card-head"><h2>デモ名護倉庫 在庫</h2>'+status("リアルタイム計算","green")+'</div><div class="card-inner">'+PRODUCTS.map(p=>'<div class="stock-row"><div class="row-main"><div><div class="row-title">'+p.name+'</div><div class="row-sub">SKU：'+p.id+'</div></div><div class="row-value">'+nf(qty(db,WH,p.id))+' <small>'+p.unit+'</small></div></div></div>').join("")+'</div></div>'+
 '<div class="card"><div class="card-head"><h2>倉庫への返却確認</h2><span class="minor">スタッフからの返却依頼</span></div><div class="card-inner">'+(returnWait.length?returnWait.map(r=>'<div class="trans-row"><div class="row-main"><div><div class="row-title">スタッフ'+r.from+' → 倉庫</div><div class="row-sub">'+product(r.sku).name+' / '+r.qty+product(r.sku).unit+' / '+fmt(r.at)+'</div></div>'+status("受領待ち","amber")+'</div><div style="margin-top:9px">'+btn("数量確認・受領","return-confirm:"+r.id,"secondary")+'</div></div>').join(""):'<div class="listempty">現在、返却待ちはありません。</div>')+'</div></div>'+
 '<div class="note">発注数と実入荷数は一致しないことがあります。仕入単価も変動するため、実際の入庫時に数量・金額を確定し、経理による照合を分離します。</div>'+
 '</div></div>';
}
function accountView(){
 const t=totals(db),inc=issues(db),pending=db.deliveries.filter(d=>d.status==="pending");
 const reviewed=db.purchaseOrders.filter(o=>o.status==="received"&&!o.checked);
 const billed=db.deliveries.filter(d=>d.status==="billed");
 return sectionHead("経理・請求照合","未請求、仕入価格差、保管中在庫、スタッフ受領待ちを一画面で確認できます。")+
 metrics([{label:"納品売上候補",value:yen(t.deliveredAmount),note:"納品分のみ計上"},
          {label:"未請求の残高",value:yen(t.unbilledAmount),note:t.unbilledCount+"件・請求確定前",type:"warning"},
          {label:"請求確定済",value:yen(t.invoiceAmount),note:"発行扱いのデモ明細",type:"positive"},
          {label:"チェック対象",value:inc.length+"件",note:"数量・単価・未請求・車載滞留",type:"warning"}])+
 '<div class="layout-wide"><div class="card"><div class="card-head"><h2>確認が必要な取引</h2>'+status(inc.length+"件","amber")+'</div><div class="card-inner">'+
 (inc.length?inc.slice(0,12).map(i=>'<div class="exception"><div class="ex-icon">'+(i.kind==="invoice"?"¥":i.kind==="purchase"?"≠":i.kind==="handoff"?"⇄":"! ")+'</div><div class="ex-body"><div class="ex-title">'+esc(i.title)+' '+(i.level==="danger"?status("要対応","red"):"")+'</div><div class="ex-text">'+esc(i.detail)+'</div></div></div>').join(""):'<div class="listempty">現在、チェック対象はありません。</div>')+
 '</div></div>'+
 '<div class="card"><div class="card-head"><h2>納品済み・未請求明細</h2><span class="minor">取引ID単位で突合</span></div><div class="card-inner">'+
 (pending.length?pending.map(d=>{
  const loss=d.amount<d.costTotal;
  return '<div class="invoice-row"><div class="row-main"><div><div class="row-title">'+esc(d.id)+' / '+facility(d.facilityId)+'</div><div class="row-sub">スタッフ'+d.holder+' / '+product(d.sku).name+' × '+nf(d.qty)+product(d.sku).unit+'</div></div>'+status("未請求","amber")+'</div>'+
  '<div class="row-sub">請求単価 '+yen(d.unitPrice)+' / 売上候補 '+yen(d.amount)+' / 仕入原価 '+yen(d.costTotal)+'</div>'+
  (loss?'<p class="note warn" style="margin:8px 0">原価割れ：管理者による確認が必要です。</p>':'')+
  '<div style="margin-top:10px">'+btn(loss?"原価割れ・確定不可":"照合OK・請求確定","invoice:"+d.id,loss?"danger":"secondary")+'</div></div>';
 }).join(""):'<div class="listempty">未請求明細はありません。</div>')+
 '</div></div>'+
 '<div class="card"><div class="card-head"><h2>仕入のダブルチェック</h2><span class="minor">発注と実仕入を比較</span></div><div class="card-inner">'+
 (reviewed.length?reviewed.map(o=>{
  let diff=o.qty!==o.actualQty||o.plannedCost!==o.actualCost;
  return '<div class="invoice-row"><div class="row-main"><div><div class="row-title">'+o.id+' / '+product(o.sku).name+'</div><div>'+status(diff?"差異あり":"一致",""+(diff?"amber":"green"))+'</div></div>'+
  '<div class="row-sub">発注 '+o.qty+' × '+yen(o.plannedCost)+' = '+yen(o.qty*o.plannedCost)+'</div>'+
  '<div class="row-sub">入庫 '+o.actualQty+' × '+yen(o.actualCost)+' = '+yen(o.actualQty*o.actualCost)+'</div>'+
  '<div style="margin-top:10px">'+btn("仕入内容を照合する","check-order:"+o.id,"secondary")+'</div></div>';
 }).join(""):'<div class="listempty">仕入照合待ちはありません。</div>')+
 '</div></div>'+
 '<div class="card"><div class="card-head"><h2>請求単価ルール（将来分）</h2>'+status("過去の単価は固定","blue")+'</div><div class="card-inner"><p class="hint" style="margin-bottom:12px">施設・商品ごとに請求単価を変更できます。既存納品明細には反映しません。</p>'+
 '<div class="field-row"><div class="field"><label>施設</label><select id="price-fac">'+facilityOpt("Y")+'</select></div><div class="field"><label>商品</label><select id="price-sku">'+productOpt("TB")+'</select></div></div>'+
 '<div class="field"><label>新しい請求単価（税抜・円）</label><input id="price-amount" type="number" min="0" value="35" inputmode="numeric"></div>'+
 '<button class="btn full secondary" data-act="price-update">以降の納品に適用</button></div></div>'+
 '</div>'+
 '<div class="card" style="margin-top:16px"><div class="card-head"><h2>担当者別・保管在庫の照合</h2><span class="minor">引渡予約分も表示</span></div>'+
 '<div class="table-wrap"><table><thead><tr><th>担当者</th><th>商品</th><th class="num">帳簿残</th><th class="num">引渡・返却予約</th><th class="num">出庫可能</th><th class="num">保管最長</th></tr></thead><tbody>'+
 STAFF.flatMap(s=>PRODUCTS.filter(p=>qty(db,staffLocation(s),p.id)>0).map(p=>{
  const age=Math.max(0,...binLots(db,staffLocation(s),p.id).map(x=>daysSince(x.custodySince||x.receivedAt)));
  return '<tr><td><strong>スタッフ'+s+'</strong></td><td>'+p.name+'</td><td class="num">'+qty(db,staffLocation(s),p.id)+p.unit+'</td><td class="num">'+reserved(db,s,p.id)+p.unit+'</td><td class="num">'+available(db,s,p.id)+p.unit+'</td><td class="num">'+(age>=7?status(age+"日","amber"):age+"日")+'</td></tr>'
 })).join("")+
 '</tbody></table></div><div class="table-footer">取引履歴から残数を計算します。倉庫出庫しただけでは請求対象になりません。</div></div>'+
 '<div class="card" style="margin-top:16px"><div class="card-head"><h2>請求確定済み（例）</h2></div><div class="card-inner">'+(billed.map(d=>'<div class="invoice-row"><div class="row-main"><div><div class="row-title">'+esc(d.invoiceId)+' / '+facility(d.facilityId)+'</div><div class="row-sub">'+esc(d.id)+' / '+product(d.sku).name+' '+d.qty+product(d.sku).unit+'</div></div><div class="row-value">'+yen(d.amount)+'</div></div></div>').join("")||'<div class="listempty">請求済みはありません。</div>')+'</div></div>';
}
function ledgerView(){
 const tables=exportTables(db);
 if(!tables[tableKey])tableKey=Object.keys(tables)[0];
 const rows=tables[tableKey],titles=Object.keys(tables);
 return sectionHead("スプレッドシート管理台帳（デモ）","在庫・仕入・移動・請求を、シート形式で確認できます。CSV出力にも対応しています。")+
 '<div class="note warn" style="margin-bottom:16px">この画面はGoogleスプレッドシートを想定した管理台帳プレビューです。現在はブラウザ内のテストデータを表示しています。Google Sheets APIとの実接続・複数端末同期・直接編集はまだ行いません。</div>'+
 '<div class="sheettoolbar"><div><label class="field-label">表示するシート</label><select class="sheet-select" id="table-select">'+options(titles.map(k=>({label:k,value:k})),tableKey)+'</select></div><div class="breakout"><button class="btn secondary" data-act="csv-download">↓ CSVダウンロード</button></div></div>'+
 '<div class="card"><div class="card-head"><h2>'+esc(tableKey)+'</h2><span class="minor">デモ表：'+nf(rows.length-1)+'行</span></div><div class="table-wrap"><table><thead><tr>'+rows[0].map(x=>'<th>'+esc(x)+'</th>').join("")+'</tr></thead><tbody>'+
 (rows.length>1?rows.slice(1,161).map(row=>'<tr>'+row.map(x=>'<td>'+esc(x)+'</td>').join("")+'</tr>').join(""):'<tr><td colspan="'+rows[0].length+'">データがありません</td></tr>')+
 '</tbody></table></div><div class="table-footer">先頭160行を表示しています。CSVは全行を出力できます。</div></div>'+
 '<div class="card" style="margin-top:16px"><div class="card-head"><h2>取引の追跡方法</h2></div><div class="card-inner"><div class="flow"><span class="step">発注ID</span><span class="arrow">→</span><span class="step">入庫ロット</span><span class="arrow">→</span><span class="step">在庫移動ID</span><span class="arrow">→</span><span class="step">納品ID</span><span class="arrow">→</span><span class="step">請求書ID</span></div><p class="hint" style="margin-top:12px">単価が変わっても、実仕入単価は入庫ロットに、請求単価は納品明細に保存します。既存明細の値は変更しません。</p></div></div>';
}
function render(){
 let content=head();
 switch(active){case"field":content+=fieldView();break;case"warehouse":content+=warehouseView();break;case"account":content+=accountView();break;case"ledger":content+=ledgerView();break}
 APP.innerHTML=content+foot();
 if(active==="field")renderAvailability();
 if(scrollOnRender){scrollOnRender=false;window.scrollTo({top:0,behavior:"instant"})}
}
function renderAvailability(){
 const el=document.getElementById("field-availability"),select=document.getElementById("field-sku");if(!el||!select)return;
 const p=product(select.value);if(!p)return;
 const n=mode==="delivery"?available(db,staff,p.id):qty(db,WH,p.id);
 el.innerHTML='<span>'+(mode==="delivery"?"スタッフ"+staff+"の出庫可能":"倉庫の現在庫")+'</span><strong>'+nf(n)+' '+p.unit+'</strong>';
}
const modalRoot=document.createElement("div");modalRoot.id="demo-modal-root";document.body.append(modalRoot);
function closeModal(){modalRoot.innerHTML="";modalAction=null}
function modal(title,body,onConfirm,label="確定する"){
 modalAction=onConfirm;
 modalRoot.innerHTML='<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="modal"><div class="modal-title"><strong>'+esc(title)+'</strong><button class="icon-btn" data-modal-close aria-label="閉じる">×</button></div><form id="demo-modal-form"><div class="modal-body">'+body+'<div class="modal-actions"><button class="btn secondary" type="button" data-modal-close>戻る</button><button class="btn" type="submit">'+esc(label)+'</button></div></div></form></div></div>';
 modalRoot.querySelector("button[data-modal-close]")?.focus();
}
modalRoot.addEventListener("click",e=>{if(e.target.closest("[data-modal-close]")||e.target.classList.contains("modal-backdrop"))closeModal()});
modalRoot.addEventListener("submit",e=>{
 if(e.target.id!=="demo-modal-form")return;
 e.preventDefault();
 try{
  const result=modalAction?.();
  if(result===false)return;
  save();closeModal();render();showToast(typeof result==="string"?result:"登録が完了しました");
 }catch(err){showToast(err.message||"入力内容を確認してください",true)}
});
function numberInput(id){const v=Number(document.getElementById(id)?.value);if(!Number.isSafeInteger(v)||v<=0)throw Error("数量は1以上の整数を入力してください");return v}
function moneyInput(id){const el=document.getElementById(id),v=Number(el?.value);if(!el?.value?.trim()||!Number.isFinite(v)||v<0)throw Error("単価は0以上で入力してください");return v}
function confirmField(){
 const sku=document.getElementById("field-sku")?.value,amount=numberInput("field-qty"),p=product(sku);
 if(!p)throw Error("商品を選択してください");
 const room=mode==="delivery"?available(db,staff,sku):qty(db,WH,sku);
 if(amount>room)throw Error("在庫不足です。利用可能数は "+room+p.unit+" です");
 const f=mode==="delivery"?document.getElementById("field-fac")?.value:null;
 const title=mode==="delivery"?"施設納品の確認":"倉庫出庫の確認";
 const rows=[["操作担当","スタッフ"+staff],["商品",p.name],["数量",amount+p.unit],["移動元",mode==="delivery"?"スタッフ"+staff:"デモ名護倉庫"],["移動先",mode==="delivery"?facility(f):"スタッフ"+staff],["処理後の出庫可能数",(room-amount)+p.unit]];
 modal(title,rows.map(x=>'<div class="confirm-line"><span>'+x[0]+'</span><strong>'+x[1]+'</strong></div>').join("")+
 '<div class="note good" style="margin-top:15px">'+(mode==="delivery"?"施設納品により売上候補と未請求明細が生成されます。":"倉庫出庫では売上候補は発生せず、スタッフの預かり在庫になります。")+'</div>',
 ()=>{const result=mode==="delivery"?checkout(db,{holder:staff,sku,amount,facilityId:f}):outbound(db,{holder:staff,sku,amount});return mode==="delivery"?"納品 "+result.id+" を登録しました。経理の未請求へ反映されています":"倉庫出庫しました。スタッフ"+staff+"の在庫が増えました"},mode==="delivery"?"納品を確定する":"出庫を確定する");
}
function openHandoff(){
 const skus=PRODUCTS.filter(p=>available(db,staff,p.id)>0);if(!skus.length)return showToast("引き渡せる商品がありません",true);
 modal("他スタッフへ引渡申請",'<p class="hint" style="margin-bottom:14px">受取側が確認するまで保管責任は移りません。申請分は出庫可能数から予約されます。</p>'+
 '<div class="field"><label>相手スタッフ</label><select id="m-target">'+staffOpt(STAFF.find(s=>s!==staff),staff)+'</select></div>'+
 '<div class="field"><label>商品</label><select id="m-sku">'+options(skus.map(p=>({value:p.id,label:p.name+"（出庫可能 "+available(db,staff,p.id)+p.unit+"）"})),skus[0].id)+'</select></div>'+
 '<div class="field"><label>申請数量</label><input type="number" id="m-qty" inputmode="numeric" min="1" value="3"></div>',
 ()=>{const to=document.getElementById("m-target").value,sku=document.getElementById("m-sku").value,q=numberInput("m-qty");const h=handoffRequest(db,{from:staff,to,sku,amount:q});return h.id+" を申請しました。相手の受領を待ちます"},"引渡しを申請する");
}
function openHandoffReceipt(){
 const list=db.transfers.filter(t=>t.to===staff&&(t.status==="pending"||t.status==="discrepancy"));
 if(!list.length)return showToast("現在、スタッフ"+staff+"宛の受領待ちはありません");
 modal("スタッフ"+staff+" の受領確認",'<p class="hint" style="margin-bottom:14px">申請数量と実際の受取数が違う場合は確定せず、差異として経理に表示します。</p>'+
 '<div class="field"><label>受領待ちの申請</label><select id="m-handoff">'+options(list.map(h=>({value:h.id,label:h.from+"→"+h.to+" / "+product(h.sku).name+" "+h.qty+product(h.sku).unit+"［"+h.status+"］"})),list[0].id)+'</select></div>'+
 '<div class="field"><label>実際に受け取った数量</label><input type="number" min="0" step="1" inputmode="numeric" id="m-received" value="'+list[0].qty+'"></div>',
 ()=>{const id=document.getElementById("m-handoff").value,q=Number(document.getElementById("m-received").value);const r=handoffConfirm(db,{id,receiver:staff,count:q});return r.discrepancy?"数量不一致：在庫は移動せず、経理の要確認へ追加しました":"受領確認が完了しました。預かり在庫へ反映しています"},"受領数量を確認する");
}
function openReturn(){
 const skus=PRODUCTS.filter(p=>available(db,staff,p.id)>0);if(!skus.length)return showToast("返却できる在庫はありません",true);
 modal("倉庫へ返却申請",'<p class="hint" style="margin-bottom:13px">倉庫担当が受取確認すると、スタッフ在庫から倉庫在庫へ移動します。</p>'+
 '<div class="field"><label>商品</label><select id="m-sku">'+options(skus.map(p=>({value:p.id,label:p.name+"（"+available(db,staff,p.id)+p.unit+"）"})),skus[0].id)+'</select></div>'+
 '<div class="field"><label>返却数量</label><input type="number" min="1" step="1" inputmode="numeric" id="m-qty" value="2"></div>',
 ()=>{const r=returnRequest(db,{holder:staff,sku:document.getElementById("m-sku").value,amount:numberInput("m-qty")});return r.id+" 返却申請しました。倉庫の受領待ちへ追加しました"},"返却申請する");
}
function openReceiveOrder(id){
 const o=db.purchaseOrders.find(x=>x.id===id);if(!o||o.status!=="ordered")return;
 modal("仕入・入荷の検品",'<div class="note" style="margin-bottom:14px">'+o.id+' / '+product(o.sku).name+'<br>発注：'+o.qty+product(o.sku).unit+' / 予定単価 '+yen(o.plannedCost)+'</div>'+
 '<div class="field"><label>実際の入荷数量</label><input type="number" min="1" step="1" id="m-qty" inputmode="numeric" value="'+o.qty+'"></div>'+
 '<div class="field"><label>実際の仕入単価（税抜・円）</label><input type="number" min="0" step="1" id="m-cost" inputmode="numeric" value="'+o.plannedCost+'"></div>',
 ()=>{receiveOrder(db,{id,actualQty:numberInput("m-qty"),actualCost:moneyInput("m-cost")});return "入庫しました。経理の仕入照合待ちに追加されました"},"入庫を確定する");
}
function openOrderReview(id){
 const o=db.purchaseOrders.find(x=>x.id===id);if(!o)return;
 const diff=o.qty!==o.actualQty||o.plannedCost!==o.actualCost;
 modal("仕入内容の照合",'<div class="confirm-line"><span>発注数量 / 実入庫数</span><strong>'+o.qty+' / '+o.actualQty+'</strong></div>'+
 '<div class="confirm-line"><span>予定単価 / 実仕入単価</span><strong>'+yen(o.plannedCost)+' / '+yen(o.actualCost)+'</strong></div>'+
 (diff?'<div class="note warn" style="margin:14px 0">数量または単価に差があります。確認理由を記録してください。</div>':'<div class="note good" style="margin:14px 0">数量・価格は一致しています。</div>')+
 '<div class="field"><label>照合メモ'+(diff?"（必須）":"")+'</label><textarea id="m-review" placeholder="例：仕入先の価格改定を確認。請求書と一致。"></textarea></div>',
 ()=>{checkOrder(db,id,document.getElementById("m-review").value);return "仕入照合を完了しました"},"仕入を承認する");
}
function openInvoice(id){
 const d=db.deliveries.find(x=>x.id===id);if(!d||d.status!=="pending")return;
 modal("経理・請求確定",'<div class="confirm-line"><span>納品ID / 施設</span><strong>'+d.id+' / '+facility(d.facilityId)+'</strong></div>'+
 '<div class="confirm-line"><span>数量</span><strong>'+d.qty+product(d.sku).unit+'</strong></div>'+
 '<div class="confirm-line"><span>仕入原価（ロット）</span><strong>'+yen(d.costTotal)+'</strong></div>'+
 '<div class="confirm-line"><span>請求単価</span><strong>'+yen(d.unitPrice)+'</strong></div>'+
 '<div class="confirm-line"><span>請求対象金額</span><strong>'+yen(d.amount)+'</strong></div>'+
 '<div class="note warn" style="margin-top:14px">このデモの「請求確定」はブラウザ内の状態変更のみです。実際の請求書送付・会計登録は行いません。</div>',
 ()=>{const r=billDelivery(db,id);return r.invoiceId+" を請求確定（デモ）しました"},"照合OK・請求確定");
}
function openReset(){
 modal("デモデータを初期化","<p>出庫・納品・仕入・受領確認などの操作履歴をすべて初期状態に戻します。</p><p class='note warn' style='margin-top:14px'>このブラウザに保存されたデモデータだけが対象です。minpakuOSの本番データには影響しません。</p>",
 ()=>{db=initialState();staff="A";active="field";mode="delivery";formSKU="TB";formFAC="X";tableKey="担当者保管在庫";return "デモを初期状態に戻しました"},"初期化する");
}
function downloadCSV(){
 const rows=exportTables(db)[tableKey];if(!rows)return;
 const quote=x=>{
  let value=String(x??"");
  if(/^[=+@\-]/.test(value))value="'"+value;
  return '"'+value.replace(/"/g,'""')+'"';
 };
 const csv="\uFEFF"+rows.map(r=>r.map(quote).join(",")).join("\r\n");
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="minpakuOS_"+tableKey+"_DEMO.csv";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast("CSVを書き出しました");
}
APP.addEventListener("click",e=>{
 const nav=e.target.closest("[data-tab]");
 if(nav){active=nav.dataset.tab;scrollOnRender=true;render();return}
 const toggle=e.target.closest("[data-mode]");
 if(toggle){mode=toggle.dataset.mode;render();return}
 const b=e.target.closest("[data-act]");if(!b)return;
 const action=b.dataset.act;
 try{
  if(action==="reset")openReset();
  else if(action==="field-submit")confirmField();
  else if(action==="handoff")openHandoff();
  else if(action==="receive-handoff")openHandoffReceipt();
  else if(action==="return")openReturn();
  else if(action==="show-history"){active="ledger";tableKey="在庫移動履歴";scrollOnRender=true;render()}
  else if(action==="order-create"){
   const sku=document.getElementById("order-sku").value,n=numberInput("order-qty"),cost=moneyInput("order-cost");
   const p=product(sku);modal("発注内容の確認",'<div class="confirm-line"><span>商品</span><strong>'+p.name+'</strong></div>'+
   '<div class="confirm-line"><span>数量</span><strong>'+n+p.unit+'</strong></div>'+
   '<div class="confirm-line"><span>予定単価</span><strong>'+yen(cost)+'</strong></div>'+
   '<div class="confirm-line"><span>発注予定金額</span><strong>'+yen(cost*n)+'</strong></div>',
   ()=>{const o=createOrder(db,{sku,qty:n,plannedCost:cost});return o.id+" を登録しました"},"発注を登録する");
  }
  else if(action.startsWith("receive-order:"))openReceiveOrder(action.slice(14));
  else if(action.startsWith("check-order:"))openOrderReview(action.slice(12));
  else if(action.startsWith("return-confirm:")){
   const id=action.slice(15),r=db.returns.find(x=>x.id===id);
   if(!r)return;modal("倉庫の受領確認",'<div class="confirm-line"><span>返却担当者</span><strong>スタッフ'+r.from+'</strong></div>'+
   '<div class="confirm-line"><span>商品 / 数量</span><strong>'+product(r.sku).name+' / '+r.qty+product(r.sku).unit+'</strong></div>',
   ()=>{returnConfirm(db,id);return "倉庫への返却を受領しました"},"受領を確定する");
  }
  else if(action.startsWith("invoice:"))openInvoice(action.slice(8));
  else if(action==="price-update"){
   const sku=document.getElementById("price-sku").value,f=document.getElementById("price-fac").value,
   price=moneyInput("price-amount");
   modal("請求単価の変更",'<div class="confirm-line"><span>施設</span><strong>'+facility(f)+'</strong></div>'+
   '<div class="confirm-line"><span>商品</span><strong>'+product(sku).name+'</strong></div>'+
   '<div class="confirm-line"><span>現在単価 → 新単価</span><strong>'+yen(priceFor(db,sku,f))+' → '+yen(price)+'</strong></div>'+
   '<div class="note" style="margin-top:12px">過去の納品明細の単価は変更されません。</div>',
   ()=>{changePrice(db,{sku,facilityId:f,newPrice:price});return "次回納品から新単価を適用します"},"単価ルールを更新");
  }
  else if(action==="csv-download")downloadCSV();
 }catch(err){showToast(err.message||"操作を完了できませんでした",true)}
});
APP.addEventListener("change",e=>{
 if(e.target.id==="staff-select"){staff=e.target.value;render()}
 if(e.target.id==="field-sku"){formSKU=e.target.value;renderAvailability()}
 if(e.target.id==="field-fac")formFAC=e.target.value;
 if(e.target.id==="table-select"){tableKey=e.target.value;render()}
 if(e.target.id==="order-sku")document.getElementById("order-cost").value=product(e.target.value).cost;
});
render();
