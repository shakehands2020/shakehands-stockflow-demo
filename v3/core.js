// minpakuOS StockFlow V3 — counted-inventory import demo
// Real inventory counts are imported from the URL fragment and NOT stored in the public source.
// ALL monetary prices in this demo are illustrative, never verified.
export const PRODUCTS = [
  {id:"SM",name:"アクアシリーズ シャンプー 2L",unit:"本",cost:1420,price:1980,seedQty:36,category:"バス",pack:"2L/本"},
  {id:"AQB",name:"アクアシリーズ ボディソープ 2L",unit:"本",cost:1420,price:1980,seedQty:24,category:"バス",pack:"2L/本"},
  {id:"CD",name:"アクアシリーズ コンディショナー 2L",unit:"本",cost:1390,price:1880,seedQty:24,category:"バス",pack:"2L/本"},
  {id:"SWC",name:"シルクウェル コンディショナー 18L",unit:"箱",cost:7400,price:9000,seedQty:7,category:"バス",pack:"18L/箱"},
  {id:"SWS",name:"シルクウェル シャンプー 18L",unit:"箱",cost:7400,price:9000,seedQty:6,category:"バス",pack:"18L/箱"},
  {id:"SWB",name:"シルクウェル ボディソープ 18L",unit:"箱",cost:7400,price:9000,seedQty:6,category:"バス",pack:"18L/箱"},
  {id:"BT",name:"クリーミーボディタオル",unit:"個",cost:15,price:28,seedQty:300,category:"アメニティ",pack:"25個/袋（14袋）"},
  {id:"SL",name:"使い捨てスリッパ",unit:"足",cost:78,price:125,seedQty:180,category:"アメニティ",pack:"1足"},
  {id:"KY",name:"カネヨ 柔軟剤",unit:"個",cost:740,price:990,seedQty:8,category:"洗剤",pack:"容量未確認"},
  {id:"RZ",name:"カミソリ",unit:"個",cost:21,price:39,seedQty:350,category:"アメニティ",pack:"100個/箱"},
  {id:"HB",name:"ヘアブラシ",unit:"個",cost:24,price:39,seedQty:200,category:"アメニティ",pack:"250個/箱"},
  {id:"TB",name:"歯ブラシ",unit:"本",cost:18,price:32,seedQty:600,category:"アメニティ",pack:"2,000本/箱"}
];
export const STAFF = ["A","B","C","D","E"];
export const FACILITIES=[
  {id:"X",name:"デモ施設X"},
  {id:"Y",name:"デモ施設Y"},
  {id:"Z",name:"デモ施設Z"}
];
export const WH="W:NAGO";
const DAYS=86_400_000;
export const atDaysAgo=n=>new Date(Date.now()-n*DAYS).toISOString();
export const daysSince=t=>Math.max(0,Math.floor((Date.now()-new Date(t).getTime())/DAYS));
export const product=id=>PRODUCTS.find(p=>p.id===id);
export const facility=id=>FACILITIES.find(f=>f.id===id)?.name||id;
export const labelLocation=loc=>loc===WH?"デモ名護倉庫":loc.startsWith("S:")?"スタッフ"+loc.slice(2):loc.startsWith("F:")?facility(loc.slice(2)):loc;
export const staffLocation=id=>"S:"+id;
function assertQty(q){if(!Number.isSafeInteger(q)||q<=0||q>1_000_000)throw Error("数量は1以上の整数で入力してください");}
function assertMoney(n){if(!Number.isFinite(n)||n<0||n>100_000_000)throw Error("単価には0以上の数値を入力してください");}
function record(state,action,description,by="DEMO",when=new Date().toISOString()){
 state.audit.unshift({id:"AUD-"+(++state.seq),action,description,by,at:when});
}
function serial(state,prefix){return prefix+"-"+String(++state.seq).padStart(4,"0")}
export function qty(state,loc,sku){return (state.bins?.[loc]?.[sku]||[]).reduce((a,b)=>a+b.qty,0)}
export function binLots(state,loc,sku){return state.bins?.[loc]?.[sku]||[]}
export function reserved(state,staff,sku){
 return state.transfers.filter(t=>t.from===staff&&t.sku===sku&&(t.status==="pending"||t.status==="discrepancy")).reduce((a,t)=>a+t.qty,0)
 +state.returns.filter(t=>t.from===staff&&t.sku===sku&&t.status==="pending").reduce((a,t)=>a+t.qty,0);
}
export function available(state,staff,sku){return qty(state,staffLocation(staff),sku)-reserved(state,staff,sku)}
function addLots(state,loc,sku,lots){
 state.bins[loc]??={};state.bins[loc][sku]??=[];
 for(const lot of lots){
   if(lot.qty<=0)continue;
   const match=state.bins[loc][sku].find(b=>b.lot===lot.lot&&b.cost===lot.cost&&b.receivedAt===lot.receivedAt&&b.custodySince===lot.custodySince);
   if(match)match.qty+=lot.qty;
   else state.bins[loc][sku].push({...lot});
 }
}
function takeLots(state,loc,sku,amount){
 assertQty(amount);
 if(qty(state,loc,sku)<amount)throw Error(labelLocation(loc)+"の在庫が不足しています");
 const bins=state.bins[loc][sku],out=[];let rest=amount;
 for(const lot of bins){
   if(!rest)break;
   const n=Math.min(rest,lot.qty);lot.qty-=n;rest-=n;
   if(n)out.push({...lot,qty:n});
 }
 state.bins[loc][sku]=bins.filter(b=>b.qty>0);
 return out;
}
export function move(state,{from,to,sku,amount,by="DEMO",when=new Date().toISOString(),type="transfer",ref=""}){
 if(from===to)throw Error("移動元と移動先が同じです");
 if(!product(sku))throw Error("商品が存在しません");
 if(from.startsWith("S:") && (type==="delivery"||type==="outbound")) {
   const staff=from.slice(2);
   if(available(state,staff,sku)<amount)throw Error("スタッフ"+staff+"の出庫可能数が不足しています（引渡予約分は除外）");
 }
 const lots=takeLots(state,from,sku,amount);
 // A procurement lot keeps its original cost, while staff custody age starts at handover.
 const arrivals=lots.map(l=>({...l,custodySince:to.startsWith("S:")?when:undefined}));
 addLots(state,to,sku,arrivals);
 const id=serial(state,"MOV");
 state.movements.unshift({id,type,from,to,sku,qty:amount,lots,at:when,by,ref});
 record(state,type,labelLocation(from)+" → "+labelLocation(to)+" / "+product(sku).name+" "+amount+product(sku).unit,by,when);
 return {id,lots,costTotal:lots.reduce((a,l)=>a+l.qty*l.cost,0)};
}
export function priceFor(state,sku,fac){
 const override=state.priceRules[fac+":"+sku];
 return override==null?product(sku).price:override;
}
export function checkout(state,{holder,sku,amount,facilityId,by=holder,when=new Date().toISOString()}){
 if(!STAFF.includes(holder))throw Error("スタッフが不正です");
 if(!FACILITIES.find(f=>f.id===facilityId))throw Error("施設が不正です");
 const movement=move(state,{from:staffLocation(holder),to:"F:"+facilityId,sku,amount,by,when,type:"delivery"});
 const unitPrice=priceFor(state,sku,facilityId);
 const id=serial(state,"DLV");
 const d={id,movementId:movement.id,holder,sku,facilityId,qty:amount,costTotal:movement.costTotal,unitPrice,amount:unitPrice*amount,status:"pending",invoiceId:null,at:when};
 state.deliveries.unshift(d);
 state.movements[0].ref=id;
 record(state,"billing_candidate",id+" / "+facility(facilityId)+" / 請求候補作成",by,when);
 return d;
}
export function outbound(state,{holder,sku,amount,by=holder,when=new Date().toISOString()}){
 if(!STAFF.includes(holder))throw Error("スタッフが不正です");
 return move(state,{from:WH,to:staffLocation(holder),sku,amount,by,when,type:"outbound"});
}
export function handoffRequest(state,{from,to,sku,amount,when=new Date().toISOString()}){
 if(!STAFF.includes(from)||!STAFF.includes(to)||from===to)throw Error("引渡先を確認してください");
 assertQty(amount);
 if(available(state,from,sku)<amount)throw Error("引渡可能数量が不足しています");
 const h={id:serial(state,"HND"),from,to,sku,qty:amount,status:"pending",at:when,receivedQty:null,confirmedAt:null};
 state.transfers.unshift(h);
 record(state,"handoff_request",from+" → "+to+"： "+product(sku).name+" "+amount+"（受領待ち）",from,when);
 return h;
}
export function handoffConfirm(state,{id,receiver,count}){
 const h=state.transfers.find(t=>t.id===id);
 if(!h||!["pending","discrepancy"].includes(h.status))throw Error("受領待ちが見つかりません");
 if(h.to!==receiver)throw Error("受取担当者が一致しません");
 if(!Number.isSafeInteger(count)||count<0)throw Error("受取数を確認してください");
 h.receivedQty=count;
 if(count!==h.qty){
   h.status="discrepancy";
   record(state,"handoff_diff",h.id+" 申請 "+h.qty+" / 実受領 "+count,receiver);
   return {discrepancy:true,handoff:h};
 }
 const m=move(state,{from:staffLocation(h.from),to:staffLocation(h.to),sku:h.sku,amount:h.qty,by:receiver,type:"handoff",ref:h.id});
 h.status="completed";h.confirmedAt=new Date().toISOString();h.movementId=m.id;
 record(state,"handoff_confirm",h.id+" / "+receiver+"受領確認",receiver);
 return {discrepancy:false,handoff:h};
}
export function cancelHandoff(state,id,reason="管理者による取消"){
 const h=state.transfers.find(t=>t.id===id);
 if(!h||!["pending","discrepancy"].includes(h.status))throw Error("取消できません");
 if(!reason.trim())throw Error("取消理由が必要です");
 h.status="cancelled";h.cancelReason=reason;record(state,"handoff_cancel",h.id+" "+reason,"経理・管理者");
 return h;
}
export function returnRequest(state,{holder,sku,amount}){
 if(!STAFF.includes(holder))throw Error("担当者が不正です");
 assertQty(amount);
 if(available(state,holder,sku)<amount)throw Error("返却可能数が不足しています");
 const r={id:serial(state,"RTN"),from:holder,sku,qty:amount,status:"pending",at:new Date().toISOString()};
 state.returns.unshift(r);record(state,"return_request",holder+" → 倉庫 "+product(sku).name+" "+amount,holder);
 return r;
}
export function returnConfirm(state,id){
 const r=state.returns.find(x=>x.id===id);
 if(!r||r.status!=="pending")throw Error("返却待ちが見つかりません");
 const m=move(state,{from:staffLocation(r.from),to:WH,sku:r.sku,amount:r.qty,type:"return",ref:id,by:"倉庫担当"});
 r.status="completed";r.movementId=m.id;record(state,"return_received",id+" / 倉庫受領","倉庫担当");return r;
}
export function createOrder(state,{sku,qty:orderQty,plannedCost}){
 assertQty(orderQty);assertMoney(plannedCost);
 if(!product(sku))throw Error("商品が不正です");
 const o={id:serial(state,"PO"),sku,qty:orderQty,plannedCost,status:"ordered",actualQty:null,actualCost:null,checked:false,at:new Date().toISOString()};
 state.purchaseOrders.unshift(o);record(state,"purchase_order",o.id+" "+product(sku).name+" "+orderQty,"仕入担当");return o;
}
export function receiveOrder(state,{id,actualQty,actualCost,when=new Date().toISOString()}){
 const o=state.purchaseOrders.find(x=>x.id===id);
 if(!o||o.status!=="ordered")throw Error("未入荷の発注がありません");
 assertQty(actualQty);assertMoney(actualCost);
 const lot=serial(state,"LOT");
 addLots(state,WH,o.sku,[{lot,qty:actualQty,cost:actualCost,receivedAt:when}]);
 o.actualQty=actualQty;o.actualCost=actualCost;o.status="received";o.receivedAt=when;o.lot=lot;
 state.movements.unshift({id:serial(state,"MOV"),type:"receipt",from:"SUPPLIER",to:WH,sku:o.sku,qty:actualQty,lots:[{lot,qty:actualQty,cost:actualCost,receivedAt:when}],at:when,by:"倉庫担当",ref:o.id});
 record(state,"receive",o.id+" 入庫 "+actualQty+" / 仕入単価 "+actualCost,"倉庫担当",when);
 return o;
}
export function checkOrder(state,id,note){
 const o=state.purchaseOrders.find(x=>x.id===id);
 if(!o||o.status!=="received"||o.checked)throw Error("照合対象がありません");
 if((o.actualQty!==o.qty||o.actualCost!==o.plannedCost)&&!String(note||"").trim())throw Error("差異がある発注には確認理由が必要です");
 o.checked=true;o.checkNote=note||"一致確認";o.checkedAt=new Date().toISOString();
 record(state,"purchase_checked",o.id+" / "+o.checkNote,"経理");
 return o;
}
export function billDelivery(state,id){
 const d=state.deliveries.find(x=>x.id===id);
 if(!d||d.status!=="pending")throw Error("未請求明細がありません");
 if(d.amount<d.costTotal)throw Error("原価割れのため管理者確認が必要です");
 d.status="billed";d.invoiceId=serial(state,"INV");d.billedAt=new Date().toISOString();
 record(state,"invoice_issued",d.invoiceId+" "+d.id+" / "+d.amount+"円","経理");return d;
}
export function changePrice(state,{sku,facilityId,newPrice}){
 if(!product(sku)||!FACILITIES.find(f=>f.id===facilityId))throw Error("商品または施設が不正です");
 assertMoney(newPrice);
 state.priceRules[facilityId+":"+sku]=newPrice;
 record(state,"price_rule",facility(facilityId)+" / "+product(sku).name+" → "+newPrice+"円","管理者");
}
export function agedHoldings(state,threshold=7){
 const list=[];
 for(const s of STAFF)for(const p of PRODUCTS)for(const lot of binLots(state,staffLocation(s),p.id)){
   if(lot.qty>0 && daysSince(lot.custodySince||lot.receivedAt)>=threshold)list.push({staff:s,sku:p.id,qty:lot.qty,days:daysSince(lot.custodySince||lot.receivedAt),lot:lot.lot});
 }
 return list.sort((a,b)=>b.days-a.days);
}
export function issues(state){
 const out=[];
 for(const d of state.deliveries.filter(x=>x.status==="pending"))
  out.push({kind:"invoice",level:"warn",title:"納品済み・未請求",detail:d.id+" "+facility(d.facilityId)+" / "+product(d.sku).name+" "+d.qty+product(d.sku).unit+" / "+d.amount.toLocaleString()+"円",id:d.id});
 for(const o of state.purchaseOrders.filter(x=>x.status==="received"&&!x.checked)){
  const reasons=[];
  if(o.qty!==o.actualQty)reasons.push("数量 "+o.qty+"→"+o.actualQty);
  if(o.plannedCost!==o.actualCost)reasons.push("単価 "+o.plannedCost+"→"+o.actualCost);
  out.push({kind:"purchase",level:reasons.length?"warn":"info",title:reasons.length?"仕入数量・単価差異":"仕入照合待ち",detail:o.id+" "+product(o.sku).name+" / "+(reasons.join("・")||"未承認"),id:o.id});
 }
 for(const h of state.transfers.filter(x=>["pending","discrepancy"].includes(x.status)))
  out.push({kind:"handoff",level:h.status==="discrepancy"?"danger":"warn",title:h.status==="discrepancy"?"引渡数量差異":"スタッフ間受領待ち",detail:h.id+" "+h.from+"→"+h.to+" / "+product(h.sku).name+" "+h.qty+product(h.sku).unit,id:h.id});
 for(const h of agedHoldings(state,7))
  out.push({kind:"aged",level:h.days>=14?"danger":"warn",title:"スタッフ保管 "+h.days+"日",detail:"スタッフ"+h.staff+" / "+product(h.sku).name+" "+h.qty+product(h.sku).unit,id:h.lot});
 return out;
}
export function totals(state){
 const open=state.deliveries.filter(d=>d.status==="pending");
 const invoiced=state.deliveries.filter(d=>d.status==="billed");
 return {unbilledCount:open.length,unbilledAmount:open.reduce((a,b)=>a+b.amount,0),invoiceAmount:invoiced.reduce((a,b)=>a+b.amount,0),
  deliveredAmount:state.deliveries.reduce((a,b)=>a+b.amount,0),issues:issues(state).length,handovers:state.transfers.filter(x=>x.status==="pending"||x.status==="discrepancy").length,
  staffUnits:STAFF.reduce((a,s)=>a+PRODUCTS.reduce((b,p)=>b+qty(state,staffLocation(s),p.id),0),0)};
}
export function initialState(){
 const state={version:2,seq:100,priceRules:{"Y:TB":34},bins:{},movements:[],deliveries:[],transfers:[],returns:[],purchaseOrders:[],audit:[]};
 for(const p of PRODUCTS)addLots(state,WH,p.id,[{lot:"LOT-OPEN-"+p.id,qty:p.seedQty,cost:p.cost,receivedAt:atDaysAgo(20)}]);
 outbound(state,{holder:"A",sku:"TB",amount:100,when:atDaysAgo(5)});
 outbound(state,{holder:"C",sku:"SL",amount:24,when:atDaysAgo(9)});
 outbound(state,{holder:"E",sku:"SM",amount:3,when:atDaysAgo(3)});
 const d1=checkout(state,{holder:"A",sku:"TB",amount:30,facilityId:"X",when:atDaysAgo(4)});
 billDelivery(state,d1.id);
 checkout(state,{holder:"A",sku:"TB",amount:20,facilityId:"Y",when:atDaysAgo(3)});
 const h=handoffRequest(state,{from:"A",to:"B",sku:"TB",amount:15,when:atDaysAgo(2)});
 handoffConfirm(state,{id:h.id,receiver:"B",count:15});
 checkout(state,{holder:"B",sku:"TB",amount:10,facilityId:"Z",when:atDaysAgo(1)});
 handoffRequest(state,{from:"C",to:"D",sku:"SL",amount:6,when:atDaysAgo(1)});
 const p1=createOrder(state,{sku:"SM",qty:10,plannedCost:1320});
 receiveOrder(state,{id:p1.id,actualQty:10,actualCost:1450,when:atDaysAgo(1)});
 const p2=createOrder(state,{sku:"TB",qty:200,plannedCost:18});
 receiveOrder(state,{id:p2.id,actualQty:198,actualCost:18,when:atDaysAgo(1)});
 return state;
}

export const COUNTED_AT="2026-11-18";
export function inventoryState(counts){
 if(!Array.isArray(counts)||counts.length!==PRODUCTS.length||counts.some(n=>!Number.isSafeInteger(n)||n<0||n>1000000))throw Error("棚卸データが不正です");
 const state={version:2,seq:100,priceRules:{"Y:TB":34},bins:{},movements:[],deliveries:[],transfers:[],returns:[],purchaseOrders:[],audit:[],sourceMode:"nago-count-2026-11-18",countedAt:COUNTED_AT,initialCounts:Object.fromEntries(PRODUCTS.map((x,i)=>[x.id,counts[i]])),sampleLoaded:false};
 for(const [i,product] of PRODUCTS.entries())if(counts[i]>0)addLots(state,WH,product.id,[{lot:"COUNT-20261118-"+product.id,qty:counts[i],cost:product.cost,receivedAt:"2026-11-18T14:42:00+09:00"}]);
 record(state,"counted_import","名護倉庫の2026-11-18棚卸数を読み込み。単価は仮設定","DEMO");
 return state;
}
export function loadScenario(state){
 if(state.sampleLoaded||state.movements.length>0||state.deliveries.length>0)throw Error("操作例は未操作の初期データでのみ追加できます。初期化して再度お試しください");
 if(qty(state,WH,"TB")<100||qty(state,WH,"SL")<24||qty(state,WH,"SM")<3)throw Error("操作例に必要な在庫が不足しています");
 outbound(state,{holder:"A",sku:"TB",amount:100,when:atDaysAgo(5)});
 outbound(state,{holder:"C",sku:"SL",amount:24,when:atDaysAgo(9)});
 outbound(state,{holder:"E",sku:"SM",amount:3,when:atDaysAgo(3)});
 const d=checkout(state,{holder:"A",sku:"TB",amount:30,facilityId:"X",when:atDaysAgo(4)});
 billDelivery(state,d.id);
 checkout(state,{holder:"A",sku:"TB",amount:20,facilityId:"Y",when:atDaysAgo(3)});
 const h=handoffRequest(state,{from:"A",to:"B",sku:"TB",amount:15,when:atDaysAgo(2)});
 handoffConfirm(state,{id:h.id,receiver:"B",count:15});
 checkout(state,{holder:"B",sku:"TB",amount:10,facilityId:"Z",when:atDaysAgo(1)});
 handoffRequest(state,{from:"C",to:"D",sku:"SL",amount:6,when:atDaysAgo(1)});
 state.sampleLoaded=true;
 record(state,"sample_scenario","出庫・車載保管・納品・未請求の操作例（実取引ではない）","DEMO");
 return state;
}

export function isValidState(s){
 return !!s&&s.version===2&&Array.isArray(s.deliveries)&&Array.isArray(s.transfers)&&Array.isArray(s.returns)&&Array.isArray(s.purchaseOrders)&&Array.isArray(s.movements)&&Array.isArray(s.audit)&&typeof s.bins==="object";
}
export function exportTables(state){
 const stock=[["場所","SKU","商品","数量","単位","原価ロット"],...Object.keys(state.bins).flatMap(loc=>PRODUCTS.flatMap(p=>binLots(state,loc,p.id).filter(b=>b.qty>0).map(b=>[labelLocation(loc),p.id,p.name,b.qty,p.unit,b.lot])))];
 const handoffs=[["引渡ID","出庫者","受取者","商品","申請数量","受領数量","状況","申請日"],...state.transfers.map(h=>[h.id,h.from,h.to,product(h.sku).name,h.qty,h.receivedQty??"",h.status,h.at])];
 const orders=[["発注ID","商品","発注数","予定単価","予定合計","実入庫数","実仕入単価","実仕入合計","経理照合","日時"],...state.purchaseOrders.map(o=>[o.id,product(o.sku).name,o.qty,o.plannedCost,o.qty*o.plannedCost,o.actualQty??"",o.actualCost??"",o.actualQty==null?"":o.actualQty*o.actualCost,o.checked?"済":"未",o.at])];
 const movements=[["取引ID","種別","移動元","移動先","商品","数量","日時","担当者","関連ID"],...state.movements.map(m=>[m.id,m.type,labelLocation(m.from),labelLocation(m.to),product(m.sku).name,m.qty,m.at,m.by,m.ref])];
 const deliveries=[["納品ID","施設","担当者","商品","納品数","原価合計","請求単価","売上候補","請求状況","請求書ID"],...state.deliveries.map(d=>[d.id,facility(d.facilityId),d.holder,product(d.sku).name,d.qty,d.costTotal,d.unitPrice,d.amount,d.status==="pending"?"未請求":"請求済",d.invoiceId||""])];
 const holders=[["担当者","SKU","商品","帳簿残","引渡予約","出庫可能数","単位"],...STAFF.flatMap(s=>PRODUCTS.map(p=>[s,p.id,p.name,qty(state,staffLocation(s),p.id),reserved(state,s,p.id),available(state,s,p.id),p.unit]))];
 const rules=[["施設","SKU","商品","請求単価（税抜サンプル）"],...FACILITIES.flatMap(f=>PRODUCTS.map(p=>[f.name,p.id,p.name,priceFor(state,p.id,f.id)]))];
 const audit=[["監査ID","操作","内容","操作ユーザー","日時"],...state.audit.map(a=>[a.id,a.action,a.description,a.by,a.at])];
 const counted=[["SKU","品名","容量・荷姿","棚卸数量","単位","棚卸日","実仕入単価","実請求単価"],...PRODUCTS.map(p=>[p.id,p.name,p.pack||"",state.initialCounts?.[p.id]??"未取込",p.unit,state.countedAt||"","未確認","未確認"])];
 const qtySummary=[["SKU","品名","期首実棚卸数","追加入庫数","倉庫残","担当者保管残","施設へ納品済","在庫整合差","単位"],...PRODUCTS.map(p=>{
  const opening=Number(state.initialCounts?.[p.id]??p.seedQty);
  const received=state.movements.filter(m=>m.type==="receipt"&&m.sku===p.id).reduce((a,m)=>a+m.qty,0);
  const warehouse=qty(state,WH,p.id),staff=STAFF.reduce((a,s)=>a+qty(state,staffLocation(s),p.id),0),facilityStock=FACILITIES.reduce((a,f)=>a+qty(state,"F:"+f.id,p.id),0);
  return [p.id,p.name,opening,received,warehouse,staff,facilityStock,opening+received-warehouse-staff-facilityStock,p.unit];
 })];
 return {"初期棚卸_名護倉庫":counted,"数量突合":qtySummary,"担当者保管在庫":holders,"在庫移動履歴":movements,"施設納品・請求":deliveries,"仕入・入荷":orders,"担当者間引渡":handoffs,"拠点別在庫":stock,"請求単価ルール（仮）":rules,"監査ログ":audit};
}
