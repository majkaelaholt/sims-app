/* SimStory Studio Grocery Planner • v4.7
   Works fully offline; state is saved in the same SimStory Studio backup.
   Serving sizes are independent game recipes, never arithmetic multipliers. Unverified sizes are excluded until you enter their in-game ingredients. */
const GROCERY = (()=>{
 'use strict';
 const D=GROCERY_DATA;
 let iconFn=null;
 const gameIcon=(...args)=>typeof iconFn==='function'?iconFn(...args):'<span class="gameicon">S</span>';
 const useIcon=fn=>{iconFn=fn;};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>Number.isInteger(n)?String(n):String(Math.round(n*100)/100);
 const clean=s=>String(s??'').trim().replace(/\s+/g,' ');
 const slug=s=>clean(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
 const num=(s,def=0)=>Number.isFinite(+s)&&+s>=0?+s:def;
 const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
 const starter={plan:[],collections:[],favorites:[],custom:[],overrides:{},pantry:{},checked:{},substitutions:{},usePrep:true,category:'All',search:'',collectionName:'',editor:null,editing:null,showPantry:false,showSubstitutions:false,pantryLens:false,pantryFilter:'matches',status:'',addPantryName:'',addPantryQty:1,preferredServingSize:'party',servingChoice:{}};
 const ensure=s=>({...starter,...(s&&typeof s==='object'?s:{}),plan:Array.isArray(s?.plan)?s.plan:[],collections:Array.isArray(s?.collections)?s.collections:[],favorites:Array.isArray(s?.favorites)?s.favorites:[],custom:Array.isArray(s?.custom)?s.custom:[],overrides:s?.overrides||{},pantry:s?.pantry||{},checked:s?.checked||{},substitutions:s?.substitutions||{},servingChoice:s?.servingChoice||{},preferredServingSize:['single','family','party'].includes(s?.preferredServingSize)?s.preferredServingSize:'party'});
 const baseRecipes=()=>D.recipes;
 function allRecipes(g){return [...D.recipes.map(r=>({...r,...(g.overrides[r.id]||{})})),...(g.custom||[]).filter(x=>!x.component)];}
 function getRecipe(g,recipeId){return allRecipes(g).find(x=>x.id===recipeId);}
 function componentMap(g){const p={...D.prep};for(const c of g.custom||[]){if(c.component&&c.name&&Array.isArray(c.ingredients)&&Number(c.yield)>0)p[c.name]={ingredients:c.ingredients,yield:Number(c.yield),custom:true};}return p;}
 function resolveName(g,n){let cur=clean(n);const visited=new Set();for(let i=0;i<6;i++){if(visited.has(cur))break;visited.add(cur);const next=clean(g.substitutions[cur]);if(!next||next===cur)break;cur=next;}return cur;}
 const SERVING_LABEL={single:'Single (×1)',family:'Family (×4)',party:'Party (×8)'};
 const SERVING_SHORT={single:'Single',family:'Family',party:'Party'};
 const ALL_SIZES=['single','family','party'];
 const has=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
 const sizesForRecipe=r=>Array.isArray(r.availableSizes)&&r.availableSizes.length?r.availableSizes:
   D.singleOnly.includes(r.id)?['single']:
   D.partyOnly.includes(r.id)||['Pizza','Waffles','Baking'].includes(r.category)?['party']:ALL_SIZES;
 const defaultSize=r=>sizesForRecipe(r)[0];
 const sizeOf=(r,size)=>sizesForRecipe(r).includes(size)?size:defaultSize(r);
 const preferredSize=(g,r)=>sizeOf(r,g.servingChoice?.[r.id]||g.preferredServingSize||'party');
 const planSize=(g,p)=>{const r=getRecipe(g,p.id);return r?sizeOf(r,p.size):'single';};
 const entryKey=(g,p)=>`${p.id}|${planSize(g,p)}`;
 function recipeVariant(g,r,size){
   const chosen=sizeOf(r,size);
   // User-edited per-size recipes take precedence, even when the variant is explicitly blank.
   if(has(r.sizeRecipes,chosen)){
     const v=r.sizeRecipes[chosen];
     if(!v||!Array.isArray(v.ingredients)||!v.ingredients.length)return null;
     return {ingredients:v.ingredients,prepped:Array.isArray(v.prepped)&&v.prepped.length?v.prepped:null,source:'user'};
   }
   // A user-authored per-size book is authoritative: blank sizes stay unknown.
   if(r.id.startsWith('custom-')&&r.sizeRecipes&&Object.keys(r.sizeRecipes).length)return null;
   const verified=D.verifiedServingSizes[r.id];
   if(has(verified,chosen)){
     const v=verified[chosen];
     return {ingredients:v.ingredients,prepped:Array.isArray(v.prepped)&&v.prepped.length?v.prepped:null,source:'verified'};
   }
   // The Sims Wiki lists identical Simple Living ingredient requirements for Gourmet sizes.
   if(r.category==='Gourmet'&&Array.isArray(r.ingredients))return {ingredients:r.ingredients,prepped:Array.isArray(r.prepped)?r.prepped:null,source:'gourmet'};
   // Legacy catalogue describes one cooking action: single for normal meals, party for group-only recipes.
   if(chosen===defaultSize(r)&&Array.isArray(r.ingredients))return {ingredients:r.ingredients,prepped:Array.isArray(r.prepped)?r.prepped:null,source:'estimate'};
   return null;
 }
 function recipeIngredients(g,r,size){
   const variant=recipeVariant(g,r,size);
   if(!variant)return null;
   return g.usePrep&&Array.isArray(variant.prepped)?variant.prepped:variant.ingredients;
 }
 const formatMeal=(r,p,g)=>`${fmt(p.batches)} × ${r.name} — ${SERVING_LABEL[planSize(g,p)]}`;
 function compute(g){
   const raw={},demand={},problems=[],missing=[],component=componentMap(g),queue=[],processed={};
   const addRaw=(n,q)=>{if(!n||!(q>0))return;const k=resolveName(g,n);raw[k]=(raw[k]||0)+q;};
   const addItem=(n,q)=>{if(!n||!(q>0))return;if(component[n]){demand[n]=(demand[n]||0)+q;if(!queue.includes(n))queue.push(n);}else addRaw(n,q);};
   for(const p of g.plan){const r=getRecipe(g,p.id);if(!r)continue;const batches=Math.max(0,Math.floor(num(p.batches,0)));if(!batches)continue;const size=planSize(g,p),items=recipeIngredients(g,r,size);if(!items){missing.push({name:r.name,id:r.id,size,batches});continue;}for(const item of items){addItem(item.name,Number(item.qty)*batches);}}
   let loop=0;
   const children=name=>(component[name]?.ingredients||[]).filter(x=>!!component[x.name]).map(x=>x.name);
   const seenCycles=new Set();
   const visits=new Set(),stack=new Set();
   function detect(n){if(stack.has(n)){seenCycles.add(n);return;}if(visits.has(n))return;visits.add(n);stack.add(n);for(const c of children(n))detect(c);stack.delete(n);}
   for(const n of Object.keys(demand))detect(n);
   if(seenCycles.size)problems.push(`Prep recipes have a circular ingredient dependency (${[...seenCycles].join(', ')}). Please edit them.`);
   if(!seenCycles.size){
     while(queue.length&&loop++<300){
       const name=queue.shift(),c=component[name];if(!c)continue;
       const required=demand[name]||0;
       const remaining=Math.max(0,required-num(g.pantry[name]));
       const target=Math.ceil(remaining/Number(c.yield));
       const diff=target-(processed[name]||0);
       if(diff>0){processed[name]=target;for(const item of c.ingredients||[])addItem(item.name,Number(item.qty)*diff);}
     }
     if(loop>=300)problems.push('Ingredient tree is too deep. Check custom recipe dependencies.');
   }
   const steps=Object.keys(demand).map(name=>{const c=component[name],required=demand[name];if(!c)return null;const inPantry=Math.min(required,num(g.pantry[name]));const needed=Math.max(0,required-inPantry);const batches=processed[name]||0;return {name,required,inPantry,batches,yield:Number(c.yield),extra:Math.max(0,batches*Number(c.yield)-needed),ingredients:c.ingredients};}).filter(Boolean);
   // Reserve pantry stock for specific recipe ingredients before fulfilling flexible
   // requirements (e.g. Any Cheese can use Cheese, but Cheese must not be counted twice).
   const available=Object.entries(g.pantry||{}).filter(([k,v])=>num(v)>0).map(([name,qty])=>({name,remaining:num(qty)}));
   const normal=s=>clean(s).toLowerCase().replace(/[^a-z0-9]/g,'');
   const normalized=n=>({eggs:'egg',tomatoes:'tomato',potatoes:'potato',carrots:'carrot',strawberries:'strawberry',blueberries:'blueberry',raspberries:'raspberry',apples:'apple',onions:'onion'}[normal(n)]||normal(n));
   const flex={...Object.fromEntries(D.defaultSubstitutions.map(x=>[x.name,x.options.slice(1)])),
     'Any Bread':['Bread'],'Any Mushroom':['Mushroom'],'Any Strawberry':['Strawberry']};
   const ordered=Object.entries(raw).sort(([a],[b])=>Number(!!flex[a])-Number(!!flex[b])||a.localeCompare(b));
   const rows=[];
   for(const [name,needed] of ordered){
     let left=needed;const used=[];
     const choices=[name,...(flex[name]||[])].map(normalized);
     // Exact stock always gets first consideration; after that use suitable produce.
     const matches=available.filter(x=>choices.includes(normalized(x.name))&&x.remaining>0).sort((a,b)=>
       (normalized(a.name)===normalized(name)?-1:0)-(normalized(b.name)===normalized(name)?-1:0)||b.remaining-a.remaining);
     for(const stock of matches){
       if(left<=0)break;
       const take=Math.min(left,stock.remaining);stock.remaining-=take;left-=take;
       if(take>0)used.push({name:stock.name,qty:take});
     }
     rows.push({name,needed,onHand:num(g.pantry[name]),covered:needed-left,fromPantry:used,toBuy:Math.max(0,left)});
   }
   const grocery=rows.sort((a,b)=>a.name.localeCompare(b.name));
   const distinct=grocery.filter(x=>x.toBuy>0).length;
   const total=grocery.reduce((a,x)=>a+x.toBuy,0);
   return {grocery,steps,problems,missing,distinct,total};
 }


 function pantryAssessment(g,r,size){
   const chosen=sizeOf(r,size);
   const variant=recipeVariant(g,r,chosen);
   if(!variant)return {status:'unknown',size:chosen,missing:[],used:[],missingKinds:0,usedKinds:0,coverage:0,missingUnits:0};
   const preview=compute({...g,plan:[{id:r.id,size:chosen,batches:1}]});
   if(preview.missing.length||preview.problems.length)return {status:'unknown',size:chosen,missing:[],used:[],missingKinds:0,usedKinds:0,coverage:0,missingUnits:0};
   const usedPrep=preview.steps.reduce((a,x)=>a+x.inPantry,0);
   const total=preview.grocery.reduce((a,x)=>a+x.needed,0)+usedPrep;
   const covered=preview.grocery.reduce((a,x)=>a+(x.covered||0),0)+usedPrep;
   const used=preview.grocery.flatMap(x=>x.fromPantry||[]);
   for(const step of preview.steps)if(step.inPantry>0)used.push({name:step.name,qty:step.inPantry});
   const missing=preview.grocery.filter(x=>x.toBuy>0).map(x=>({name:x.name,qty:x.toBuy}));
   const usage=used.reduce((a,x)=>a+x.qty,0);
   const status=!total&&!preview.steps.length?'none':missing.length===0?'ready':usage>0?'partial':'empty';
   return {status,size:chosen,missing,used,missingKinds:missing.length,usedKinds:new Set(used.map(x=>x.name)).size,coverage:total?covered/total:0,missingUnits:missing.reduce((a,x)=>a+x.qty,0),usedUnits:usage,source:variant.source};
 }
 function pantryScore(a){
   if(a.status==='ready')return 100000+a.usedUnits*120+a.usedKinds*10;
   if(a.status==='partial')return 20000+a.coverage*7000+a.usedUnits*110+a.usedKinds*100-a.missingKinds*350-a.missingUnits*25;
   if(a.status==='none')return 150;
   if(a.status==='unknown')return -10000;
   return 0;
 }
 function sortedPantryRecipes(g,recipes){
   return recipes.map(r=>({recipe:r,match:pantryAssessment(g,r,preferredSize(g,r))}))
     .filter(x=>{
       if(!g.pantryLens)return true;
       if(g.pantryFilter==='ready')return x.match.status==='ready';
       if(g.pantryFilter==='almost')return x.match.status==='partial'&&x.match.missingKinds<=2;
       if(g.pantryFilter==='all')return true;
       return ['ready','partial'].includes(x.match.status);
     })
     .sort((a,b)=>g.pantryLens?pantryScore(b.match)-pantryScore(a.match)||a.recipe.name.localeCompare(b.recipe.name):0);
 }
 function pantryMatchHtml(a){
   if(!a)return '';
   if(a.status==='unknown')return '<div class="gp-match gp-match-unknown">Ingredient details needed for this size — no pantry prediction.</div>';
   if(a.status==='none')return '<div class="gp-match gp-match-muted">No listed groceries for this recipe size.</div>';
   const header=a.status==='ready'?(a.source==='estimate'?'<b>✓ Likely ready</b>':'<b>✓ Ready to cook</b>'):'<b>Shopping still needed</b>';
   const used=a.used.length?'<div class="gp-match-have"><strong>Using what you have:</strong> '+a.used.map(x=>`${fmt(x.qty)} × ${esc(x.name)}`).join(' · ')+'</div>':'';
   const missing=a.missing.length?'<div class="gp-match-missing"><strong>Still missing:</strong> '+a.missing.map(x=>`${fmt(x.qty)} × ${esc(x.name)}`).join(' · ')+'</div>':'';
   const pct=Math.round(a.coverage*100);
   return `<div class="gp-match ${a.status==='ready'?'gp-match-ready':a.status==='partial'?'gp-match-partial':'gp-match-empty'}"><div class="gp-match-top">${header}<span>${pct}% of raw ingredients covered</span></div><div class="gp-match-track"><span style="width:${pct}%"></span></div>${used}${missing}${a.source==='estimate'?'<small class="gp-estimate-disclaimer">Starter ingredient estimate — confirm in your game.</small>':''}</div>`;
 }
 function pantryFinderControls(g,all){
   const entries=Object.entries(g.pantry).filter(([_,q])=>num(q)>0);
   const suggestions=[...new Set([
     ...all.flatMap(r=>r.ingredients||[]).map(x=>x.name),
     ...Object.values(D.verifiedServingSizes).flatMap(x=>Object.values(x).flatMap(v=>v.ingredients||[])).map(x=>x.name),
     ...Object.keys(componentMap(g)),
     ...D.defaultSubstitutions.flatMap(x=>x.options),
     'Bread','Strawberry','Mushroom',
     ...Object.keys(g.pantry)
   ])].sort((a,b)=>a.localeCompare(b));
   const inventory=entries.length?entries.slice(0,12).map(([name,qty])=>`<span class="gp-stock-pill">${fmt(num(qty))} × ${esc(name)}</span>`).join('')+(entries.length>12?`<span class="gp-stock-pill">+${entries.length-12} more</span>`:''):'<span class="gp-helptext">No pantry ingredients saved yet. Add one below to start matching.</span>';
   return `<div class="gp-pantry-finder"><div class="gp-pantry-finder-title"><div><strong>Find meals from my pantry</strong><small>See what you can cook now, what needs only a few groceries, and which ingredients you'll use up.</small></div><label class="gp-switch"><input type="checkbox" data-g-change="pantryLens" ${g.pantryLens?'checked':''}/> ${g.pantryLens?'On':'Off'}</label></div>${g.pantryLens?`<div class="gp-stock-row">${inventory}</div><div class="gp-pantry-add gp-quick-stock"><input list="gp-known-ingredients" data-g-input="addPantryName" placeholder="Add an ingredient you own" value="${esc(g.addPantryName)}" aria-label="Pantry ingredient"/><input type="number" data-g-input="addPantryQty" min="1" value="${esc(g.addPantryQty)}" aria-label="Quantity"/><button class="btn tiny" data-action="g-add-pantry">+ Pantry</button></div><datalist id="gp-known-ingredients">${suggestions.map(n=>`<option value="${esc(n)}"></option>`).join('')}</datalist><label class="gp-pantry-filter-label">Show recipes<select data-g-change="pantryFilter"><option value="matches" ${g.pantryFilter==='matches'?'selected':''}>Using my ingredients</option><option value="ready" ${g.pantryFilter==='ready'?'selected':''}>Ready to cook now</option><option value="almost" ${g.pantryFilter==='almost'?'selected':''}>Only 1–2 ingredients missing</option><option value="all" ${g.pantryFilter==='all'?'selected':''}>All recipes, ranked</option></select></label><p class="gp-finder-note">Each recipe is checked separately for the size selected below. Adding multiple recipes can use the same pantry stock; your combined shopping list recalculates totals. Flexible requirements like “Any Vegetable” can use supported produce you already own. Prep calculations follow your current Home Chef Hustle setting.</p>`:''}</div>`;
 }

 function savedPlans(g){return (g.collections||[]).map(c=>({...c,items:(c.items||[]).filter(x=>getRecipe(g,x.id))}));}
 function summaryText(g){const plan=g.plan.map(p=>{const r=getRecipe(g,p.id);return r?formatMeal(r,p,g):null}).filter(Boolean);
   const c=compute(g);return [`SIMSTORY STUDIO — GROCERY LIST`, '',`MEALS (${plan.length})`,...plan.map(x=>'• '+x),'',`BUY (${c.distinct} ingredients)`, ...c.grocery.filter(x=>x.toBuy>0).map(x=>`[${g.checked[x.name]?'x':' '}] ${fmt(x.toBuy)} × ${x.name}`),...(c.missing.length?['','⚠ INCOMPLETE — MISSING SIZE-SPECIFIC INGREDIENTS',...c.missing.map(x=>`• ${x.name}: ${SERVING_LABEL[x.size]} (${x.batches} cooking action(s)) — edit this recipe before treating your list as complete`)]:[]),'',`PREP IN THE STAND MIXER`,...(c.steps.filter(x=>x.batches>0).map(x=>`• ${x.name}: make ${x.batches} batch(es) → ${fmt(x.batches*x.yield)} portions; use ${fmt(x.required)} total`)), '', 'Serving sizes use separate ingredient profiles. Missing size profiles are omitted, not multiplied or guessed. Verify estimates against your game menu.'].join('\n');}

 function copy(s,done){const str=summaryText(s); if(navigator.clipboard?.writeText){navigator.clipboard.writeText(str).then(()=>done('Shopping list copied!')).catch(()=>fallback());}else fallback(); function fallback(){const t=document.createElement('textarea');t.value=str;document.body.appendChild(t);t.select();const ok=document.execCommand('copy');t.remove();done(ok?'Shopping list copied!':'Copy unavailable here; use Download .txt instead.');}}
 function download(s){const blob=new Blob([summaryText(s)],{type:'text/plain;charset=utf-8'});const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download='simstory-grocery-list.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),2000);}
 function parseIngredientLines(s){const arr=[];for(const line of String(s||'').split(/\r?\n/)){let x=clean(line);if(!x)continue;let m=x.match(/^(.+?)\s*(?::|\s+x|\s+×)\s*(\d+(?:\.\d+)?)\s*$/i);if(!m)m=x.match(/^(.+?)\s*\*\s*(\d+(?:\.\d+)?)\s*$/);let name=clean(m?m[1]:x);let qty=m?num(m[2],1):1;if(!name||!(qty>0))continue;arr.push({name,qty});}return arr;}
 function toLines(items){return (items||[]).map(x=>`${x.name}: ${fmt(x.qty)}`).join('\n');}
 function packIcon(pack){if(pack==='custom')return '<span class="gp-pack">Custom recipe</span>';const p=DATA.packs.find(x=>x.id===pack);return p?`<span class="gp-pack">${gameIcon('pack',p.name,true)}${esc(p.name)}</span>`:'<span class="gp-pack">Base Game</span>';}
 function ingredientDescription(items){return (items||[]).length?(items||[]).map(x=>`${fmt(x.qty)} × ${esc(x.name)}`).join(' · '):'No listed ingredients';}
 function recipeCard(g,r,assessment){
   const sizes=sizesForRecipe(r),chosen=preferredSize(g,r);
   const planned=g.plan.find(p=>p.id===r.id&&planSize(g,p)===chosen),favorite=g.favorites.includes(r.id);
   const variant=recipeVariant(g,r,chosen),items=recipeIngredients(g,r,chosen);
   const needsDetails=!variant;
   const otherReady=g.pantryLens&&assessment?.status!=='ready'?sizes.filter(k=>k!==chosen&&pantryAssessment(g,r,k).status==='ready'):[];
   return `<article class="gp-recipe ${g.pantryLens&&assessment?`gp-highlight-${assessment.status}`:''}"><div class="gp-rec-head"><div class="gp-food-icon">${gameIcon('skill',r.category==='Gourmet'?'Gourmet Cooking':'Cooking',true)}</div><div class="gp-rec-title"><b>${esc(r.name)}</b><small>${esc(r.category)} · ${esc(r.skill||'Cooking')} ${Number(r.level)||1}</small></div><button class="gp-iconbutton ${favorite?'on':''}" title="${favorite?'Remove favorite':'Favorite this recipe'}" aria-label="Favorite ${esc(r.name)}" data-action="g-favorite" data-id="${esc(r.id)}">${favorite?'★':'☆'}</button></div><div class="gp-pack-row">${packIcon(r.pack)}</div><label class="gp-serving-label">Cook size<select class="gp-serving-select" data-g-change="recipeSize" data-id="${esc(r.id)}" aria-label="Select servings for ${esc(r.name)}">${sizes.map(k=>`<option value="${k}" ${k===chosen?'selected':''}>${SERVING_LABEL[k]}</option>`).join('')}</select></label><div class="gp-rec-ingredients">${needsDetails?'<span class="gp-unverified">Ingredients for this size not entered</span>':ingredientDescription(items)}</div>${!sizes.includes(g.preferredServingSize)?`<small class="gp-size-exception">${SERVING_SHORT[g.preferredServingSize]||'Chosen'} size isn't available for this dish; showing ${SERVING_SHORT[chosen]}.</small>`:''}${variant?.source==='estimate'?'<small class="gp-detail-note">Starter estimate; confirm in your game.</small>':''}${r.notes?`<small class="gp-detail-note">${esc(r.notes)}</small>`:''}${g.pantryLens?pantryMatchHtml(assessment):''}${otherReady.length?`<small class="gp-other-ready">Also cookable: ${otherReady.map(k=>SERVING_SHORT[k]).join(', ')} — change serving size above</small>`:''}<div class="gp-rec-actions"><button class="btn tiny primary" data-action="g-add" data-id="${esc(r.id)}">${planned?'＋ Another cooking action':'＋ Add meal'}</button><button class="btn tiny" data-action="g-edit" data-id="${esc(r.id)}">Edit sizes</button></div></article>`;
 }

 function globalServingControls(g,recipes){
   const requested=g.preferredServingSize||'party';
   const unavailable=recipes.filter(r=>!sizesForRecipe(r).includes(requested)).length;
   return `<div class="gp-global-size"><div class="gp-global-size-head"><div><strong>Serving size for all recipes</strong><small>Show every supported dish as Single, Family, or Party. Tap a size to apply it to all recipe cards.</small></div><span class="gp-global-current">${SERVING_SHORT[requested]} default</span></div><div class="gp-global-size-actions" role="group" aria-label="Serving size for all recipe cards">${ALL_SIZES.map(size=>`<button class="gp-global-size-button ${requested===size?'selected':''}" type="button" data-action="g-global-size" data-id="${size}" aria-pressed="${requested===size}">${SERVING_LABEL[size]}</button>`).join('')}</div><div class="gp-global-size-foot"><small>${unavailable?`${unavailable} recipe${unavailable===1?'':'s'} don't offer ${SERVING_SHORT[requested]}; they keep their in-game available size.`:`Every listed recipe offers ${SERVING_SHORT[requested]}.`} You can still change a single card below. Meals already in your plan keep their sizes.</small>${g.plan.length?`<button class="btn tiny gp-apply-plan" data-action="g-apply-plan-size">Apply ${SERVING_SHORT[requested]} to meal plan</button>`:''}</div></div>`;
 }

 function intro(s,owned){let recipes=allRecipes(s).filter(r=>r.pack==='base'||r.pack==='custom'||owned.includes(r.pack));
   const q=s.search.toLowerCase(); if(q)recipes=recipes.filter(r=>[r.name,r.category,r.pack,r.skill,...(r.ingredients||[]).map(x=>x.name)].join(' ').toLowerCase().includes(q));
   if(s.category==='Favorites')recipes=recipes.filter(r=>s.favorites.includes(r.id));else if(s.category!=='All')recipes=recipes.filter(r=>r.category===s.category);
   const counts=allRecipes(s).filter(r=>r.pack==='base'||r.pack==='custom'||owned.includes(r.pack));
   const tabs=['All','Favorites',...D.categories.filter(x=>x!=='All')];
   const matchResults=sortedPantryRecipes(s,recipes);
   return `<section class="gp-card"><div class="gp-flex-heading"><div><div class="gp-heading-strap">01 / Pick your meals</div><h2>Recipe shelf</h2><p>Choose the dishes you actually want to cook. Choose the game’s serving size for each dish, then add as many cooking actions as you want.</p></div><div class="gp-stat">${counts.length}<span>available recipes</span></div></div>${globalServingControls(s,counts)}${pantryFinderControls(s,counts)}<div class="gp-filters"><input class="searchinput" data-g-input="search" placeholder="Search meals or ingredients…" value="${esc(s.search)}" aria-label="Search recipes"/><select data-g-change="category" aria-label="Recipe category">${tabs.map(t=>`<option value="${esc(t)}" ${s.category===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div>${s.pantryLens?`<p class="gp-matches-count">${matchResults.length} recipe${matchResults.length===1?'':'s'} shown for this size and filter</p>`:''}<div class="gp-recipe-grid">${matchResults.map(x=>recipeCard(s,x.recipe,x.match)).join('')}${!matchResults.length?`<div class="gp-empty">${s.pantryLens?'No recipes match this pantry filter and serving size. Try another size, or choose All recipes, ranked.':'No recipes match those filters. You can add a custom recipe below.'}</div>`:''}</div><p class="gp-footnote">Starter catalog based on community recipe guides, not a complete in-game database. Requirements may differ with game updates or mods.</p></section>`;}
 function planner(s){return `<section class="gp-card"><div class="gp-flex-heading"><div><div class="gp-heading-strap">02 / Menu for this shopping trip</div><h2>My meal plan</h2><p>Select Single (×1), Family (×4), or Party (×8). Sizes are game recipes—not ingredient multipliers.</p></div><button class="btn tiny" data-action="g-clear-plan">Clear plan</button></div>${s.plan.length?`<div class="gp-plan-list">${s.plan.map(p=>{const r=getRecipe(s,p.id);if(!r)return'';const size=planSize(s,p),key=entryKey(s,p);const missing=!recipeVariant(s,r,size);return `<div class="gp-plan-item"><div><b>${esc(r.name)}</b><small>${esc(r.category)} · ${packIcon(r.pack)}</small>${missing?'<small class="gp-unverified">Needs ingredient entry for this size</small>':''}</div><div class="gp-plan-controls"><label>Size<select class="gp-serving-select" data-g-change="planSize" data-id="${esc(key)}" aria-label="Serving size for ${esc(r.name)}">${sizesForRecipe(r).map(k=>`<option value="${k}" ${k===size?'selected':''}>${SERVING_LABEL[k]}</option>`).join('')}</select></label><label>Make <input type="number" min="1" max="100" step="1" value="${Math.max(1,Math.floor(num(p.batches,1)))}" data-g-change="batches" data-id="${esc(key)}" aria-label="Cooking actions for ${esc(r.name)}"/></label><button class="gp-iconbutton" data-action="g-remove" data-id="${esc(key)}" title="Remove meal" aria-label="Remove ${esc(r.name)}">×</button></div></div>`}).join('')}</div>`:'<div class="gp-empty">Your list is empty. Add a few meals from the Recipe Shelf.</div>'}<div class="gp-toggle"><label><input type="checkbox" data-g-change="prep" ${s.usePrep?'checked':''}/> <b>Use Home Chef Hustle prepped ingredients</b></label><small>${s.usePrep?'Known stand-mixer ingredients are expanded into raw materials, with five portions per batch.':'Direct ingredients are used where available; no stand-mixer components substituted automatically.'}</small></div><div class="gp-saved"><h3>Save & reuse meal collections</h3><div class="gp-save-row"><input data-g-input="collectionName" maxlength="80" placeholder="e.g. My family dinners" value="${esc(s.collectionName)}"/><button class="btn tiny primary" data-action="g-save-collection">Save this menu</button></div><div class="gp-collections">${D.prebuiltCollections.map((c,i)=>`<div class="gp-collection"><span>${esc(c.name)} <small>suggested</small></span><button class="btn tiny" data-action="g-load-preset" data-id="${i}">Use</button></div>`).join('')}${savedPlans(s).map(c=>`<div class="gp-collection"><span>${esc(c.name)} <small>${c.items.length} meals</small></span><div><button class="btn tiny" data-action="g-load-collection" data-id="${esc(c.id)}">Load</button><button class="gp-iconbutton" data-action="g-delete-collection" data-id="${esc(c.id)}" title="Delete collection">×</button></div></div>`).join('')}</div></div></section>`;}

 function shopRow(s,x){
   const have=x.fromPantry?.length?` · Pantry: ${x.fromPantry.map(v=>`${fmt(v.qty)} ${esc(v.name)}`).join(', ')}`:'';
   return `<div class="gp-shopping-item ${s.checked[x.name]?'done':''}">
     <label><input type="checkbox" data-g-change="checked" data-id="${esc(x.name)}" ${s.checked[x.name]?'checked':''}/>
       <span><b>${fmt(x.toBuy)} × ${esc(x.name)}</b><small>Need ${fmt(x.needed)} total${have}</small></span>
     </label>
     <label class="gp-havelabel">Have <input type="number" data-g-change="pantry" data-id="${esc(x.name)}" value="${fmt(x.onHand)}" step="1" min="0" max="9999" aria-label="Amount on hand of ${esc(x.name)}"/></label>
   </div>`;
 }
 function shoppingListView(s,data){
   const active=data.grocery.filter(x=>x.toBuy>0),done=active.filter(x=>s.checked[x.name]).length;
   if(!s.plan.length)return '<div class="gp-empty">Choose meals first and your shopping list will appear automatically.</div>';
   if(!active.length)return '<div class="gp-empty">You have everything on this menu! Check your inventory and prep steps below.</div>';
   return `<div class="gp-progress">${done} of ${active.length} items checked off</div><div class="gp-shopping-items">${active.map(x=>shopRow(s,x)).join('')}</div>`;
 }
 function pantryView(s){
   const saved=Object.entries(s.pantry).filter(([_,q])=>num(q)>0).sort((a,b)=>a[0].localeCompare(b[0]));
   const entries=saved.map(([name,q])=>`<label>${esc(name)} <input type="number" min="0" step="1" value="${num(q)}" data-g-change="pantry" data-id="${esc(name)}"/></label>`).join('');
   return `<details class="gp-details" data-g-details="pantry" ${s.showPantry?'open':''}><summary>Pantry / fridge inventory</summary><p>Enter what you already have, including prepped components. The list will subtract these amounts.</p><div class="gp-pantry-add"><input data-g-input="addPantryName" placeholder="Ingredient name" value="${esc(s.addPantryName)}" aria-label="Ingredient to add"/><input data-g-input="addPantryQty" type="number" min="1" value="${num(s.addPantryQty,1)}" aria-label="Quantity to add"/><button class="btn tiny" data-action="g-add-pantry">Add</button></div><div class="gp-pantry-grid">${entries||'<small>No stored ingredients yet.</small>'}</div></details>`;
 }
 function substitutionsView(s){
   const entries=D.defaultSubstitutions.map(item=>`<label>${esc(item.name)}<select data-g-change="substitution" data-id="${esc(item.name)}">${item.options.map(o=>`<option value="${esc(o)}" ${(s.substitutions[item.name]||item.name)===o?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`).join('');
   return `<details class="gp-details" data-g-details="substitutions" ${s.showSubstitutions?'open':''}><summary>Choose actual produce / substitutions</summary><p>For flexible requirements like “Any Fruit,” choose what you plan to buy. The game accepts more varieties than these examples.</p><div class="gp-sub-grid">${entries}</div></details>`;
 }
 function prepView(data){
   if(!data.steps.length)return '';
   const entries=data.steps.map(x=>`<div class="gp-prep-step"><div><b>${esc(x.name)}</b><small>Need ${fmt(x.required)} · in fridge ${fmt(x.inPantry)} · ${x.batches} batch(es) to prepare${x.extra?` · ${fmt(x.extra)} left over`:''}</small></div><span>${x.batches} × mixer</span><small>${ingredientDescription(x.ingredients)} per batch → ${x.yield} portions</small></div>`).join('');
   return `<div class="gp-prep"><h3>Stand-mixer prep breakdown</h3><p>Shopping list above already includes the raw ingredients for these batches—don't buy finished dough separately unless you prefer to.</p>${entries}</div>`;
 }
 function shopping(s){
   const data=compute(s);
   return `<section class="gp-card gp-shop"><div class="gp-flex-heading"><div><div class="gp-heading-strap">03 / The combined list</div><h2>What to buy</h2><p>Repeated ingredients are combined automatically, and pantry amounts are subtracted.</p></div><div class="gp-stat">${data.distinct}<span>ingredients to get</span></div></div><div class="gp-shop-tools"><button class="btn tiny primary" data-action="g-copy">Copy list</button><button class="btn tiny" data-action="g-download">Download .txt</button><button class="btn tiny" data-action="g-print">Print</button><button class="btn tiny" data-action="g-clear-checked">Clear checkmarks</button></div>${data.missing.length?`<div class="gp-warning gp-unverified-panel"><strong>Shopping list incomplete</strong><p>${data.missing.length} meal size${data.missing.length===1?'':'s'} have no confirmed ingredient quantities. They are <b>not included</b> in the totals below. Use <b>Edit sizes</b> on each recipe to enter the amounts shown in your game.</p><ul>${data.missing.map(x=>`<li>${esc(x.name)} — ${SERVING_LABEL[x.size]} × ${x.batches} cooking action(s)</li>`).join('')}</ul></div>`:''}${shoppingListView(s,data)}${pantryView(s)}${substitutionsView(s)}${prepView(data)}${data.problems.length?`<div class="gp-warning">${data.problems.map(esc).join(' • ')}</div>`:''}<div class="gp-footnote">Sources: <a href="https://simscommunity.info/2023/10/19/ultimate-sims-4-recipe-list/" target="_blank" rel="noreferrer">Sims Community recipe guide</a> and <a href="https://sims.fandom.com/wiki/Cooking_(The_Sims_4)" target="_blank" rel="noreferrer">The Sims Wiki</a>. These are planning estimates; check your in-game requirements.</div></section>`;
 }
 function editor(s){
   const e=s.editor;
   if(!e){
     const mine=s.custom.length?`<div class="gp-myrecipes"><b>My recipes & components</b>${s.custom.map(r=>`<div class="gp-myrecipe"><span>${esc(r.name)} ${r.component?'<small>prep ingredient</small>':''}</span><button class="btn tiny" data-action="g-edit" data-id="${esc(r.id)}">Edit</button><button class="gp-iconbutton" data-action="g-delete-custom" data-id="${esc(r.id)}">×</button></div>`).join('')}</div>`:'';
     return `<section class="gp-card"><div class="gp-flex-heading"><div><div class="gp-heading-strap">04 / Make it yours</div><h2>Personal recipe book</h2><p>Set ingredients separately for each in-game serving size, or add custom meals.</p></div><button class="btn tiny primary" data-action="g-new-recipe">＋ New recipe</button></div>${mine}</section>`;
   }
   const isBuiltin=D.recipes.some(r=>r.id===e.id);
   const title=isBuiltin?'Edit a built-in recipe':(s.editing?'Edit your recipe':'Create a custom recipe');
   const categories=D.categories.filter(c=>c!=='All').map(c=>`<option ${e.category===c?'selected':''}>${esc(c)}</option>`).join('');
   const packOptions=DATA.packs.filter(x=>!['nature','adventure','royal'].includes(x.id)).map(x=>`<option value="${esc(x.id)}" ${e.pack===x.id?'selected':''}>${esc(x.name)}</option>`).join('');
   const customPack=isBuiltin?'':`<option value="custom" ${e.pack==='custom'?'selected':''}>Custom / no pack</option>`;
   const componentOnly=e.component;
   const sizes=componentOnly?'':`<div class="gp-wide gp-size-fields"><p><strong>Ingredients per cooking size</strong> — These are separate Sims 4 recipes, not x4/x8 multipliers. Leave an unknown size blank until you've checked it in-game.</p>${sizesForRecipe(e).map(size=>{const v=e.sizeDraft?.[size]||{ingredientsText:'',preppedText:''};return `<div class="gp-size-edit"><h3>${SERVING_LABEL[size]}</h3><label>Required groceries<textarea data-g-input="editSizeIngredients" data-size="${size}" rows="4" placeholder="Flour: 1&#10;Egg: 1">${esc(v.ingredientsText)}</textarea></label><label>Alternative prepped ingredients (optional)<textarea data-g-input="editSizePrepped" data-size="${size}" rows="3" placeholder="Dough: 1">${esc(v.preppedText)}</textarea></label></div>`}).join('')}</div>`;
   const componentChoice=isBuiltin?'':`<label class="gp-wide gp-checkbox"><input data-g-change="editComponent" type="checkbox" ${componentOnly?'checked':''}/> This is a prep component (like dough or batter)</label>${componentOnly?`<label>Yield per batch<input data-g-input="editYield" type="number" min="1" max="100" value="${num(e.yield,1)}"/></label>`:''}`;
   const reset=isBuiltin&&s.overrides[e.id]?`<button class="btn" data-action="g-reset-recipe" data-id="${esc(e.id)}">Restore original</button>`:'';
   return `<section class="gp-card"><div class="gp-heading-strap">04 / Personal recipe book</div><h2>${title}</h2><p>One ingredient per line, for example <b>Flour: 2</b>. Prep ingredients like Dough can also be expanded automatically.</p><div class="gp-editor"><label>Recipe name<input data-g-input="editName" value="${esc(e.name||'')}" maxlength="100" placeholder="Recipe name" ${isBuiltin?'readonly':''}/></label><label>Category<select data-g-change="editCategory">${categories}</select></label><label>Pack<select data-g-change="editPack">${packOptions}${customPack}</select></label><label>Skill level<input data-g-input="editLevel" type="number" min="1" max="10" value="${num(e.level,1)}"/></label>${componentOnly?`<label class="gp-wide">Prep component ingredients<textarea data-g-input="editIngredients" rows="6" placeholder="Flour: 2&#10;Egg: 1">${esc(e.ingredientsText)}</textarea></label>`:sizes}${componentChoice}<div class="gp-wide gp-editor-actions"><button class="btn primary" data-action="g-save-recipe">Save recipe sizes</button><button class="btn" data-action="g-cancel-edit">Cancel</button>${reset}</div></div></section>`;
 }

 function render(g,owned){const s=ensure(g);return `<div class="gp-root"><div class="page-heading"><div><div class="eyebrow">${gameIcon('skill','Cooking',true)} SIMPLE LIVING • HOME CHEF HUSTLE</div><h1>Grocery Planner</h1><p>Plan Sims meals once. Let your shopping list build itself—even when dough, batter, and other prepared ingredients are involved.</p></div></div><div class="gp-intro"><div>${gameIcon('skill','Cooking')}<div><b>One list for the whole menu</b><small>Recipe shelf → meal collections → combined shopping list → stand-mixer prep</small></div></div><span class="gp-tag">Works offline</span></div>${s.status?`<div class="gp-status">${esc(s.status)}</div>`:''}<div class="gp-columns"><div class="gp-left">${planner(s)}${shopping(s)}</div><div class="gp-right">${intro(s,owned)}${editor(s)}</div></div><div class="gp-footer">Sims 4 fan planning tool · Quantities are customizable estimates · Your data stays in this browser and exports with SimStory Studio backups.</div></div>`;}
 function updateInput(el,s,notify){const field=el.dataset.gInput;switch(field){case 'search':s.search=el.value; notify(true,'search');break;case 'collectionName':s.collectionName=el.value;notify(false);break;case 'addPantryName':s.addPantryName=el.value;notify(false);break;case 'addPantryQty':s.addPantryQty=el.value;notify(false);break;case 'editName': if(s.editor)s.editor.name=el.value;notify(false);break;case 'editIngredients':if(s.editor)s.editor.ingredientsText=el.value;notify(false);break;case 'editLevel':if(s.editor)s.editor.level=el.value;notify(false);break;case 'editYield':if(s.editor)s.editor.yield=el.value;notify(false);break;case 'editSizeIngredients':if(s.editor&&s.editor.sizeDraft?.[el.dataset.size])s.editor.sizeDraft[el.dataset.size].ingredientsText=el.value;notify(false);break;case 'editSizePrepped':if(s.editor&&s.editor.sizeDraft?.[el.dataset.size])s.editor.sizeDraft[el.dataset.size].preppedText=el.value;notify(false);break;}}
 function updateChange(el,s,notify){const f=el.dataset.gChange,k=el.dataset.id;switch(f){
   case 'category':s.category=el.value;break;
   case 'pantryLens':s.pantryLens=el.checked;break;
   case 'pantryFilter':s.pantryFilter=el.value;break;
   case 'prep':s.usePrep=el.checked;break;
   case 'recipeSize':s.servingChoice[k]=el.value;break;
   case 'batches':{const x=s.plan.find(p=>entryKey(s,p)===k);if(x)x.batches=Math.min(100,Math.max(1,Math.floor(num(el.value,1))));break;}
   case 'planSize':{const x=s.plan.find(p=>entryKey(s,p)===k);if(x){const r=getRecipe(s,x.id);if(r){const desired=sizeOf(r,el.value);const existing=s.plan.find(p=>p!==x&&p.id===x.id&&planSize(s,p)===desired);if(existing){existing.batches+=x.batches;s.plan=s.plan.filter(p=>p!==x);}else x.size=desired;}}break;}
   case 'pantry':{const q=Math.min(9999,Math.max(0,num(el.value)));if(q===0)delete s.pantry[k];else s.pantry[k]=q;break;}
   case 'checked':s.checked[k]=el.checked;break;
   case 'substitution':if(el.value===k)delete s.substitutions[k];else s.substitutions[k]=el.value;break;
   case 'editCategory':if(s.editor)s.editor.category=el.value;break;
   case 'editPack':if(s.editor)s.editor.pack=el.value;break;
   case 'editComponent':if(s.editor){s.editor.component=el.checked;if(!el.checked&&!(s.editor.sizeDraft&&Object.keys(s.editor.sizeDraft).length))s.editor.sizeDraft=Object.fromEntries(ALL_SIZES.map(k=>[k,{ingredientsText:'',preppedText:''}]));}break;
 }notify(true);}

 function action(action,key,s,notify){const saved=msg=>{s.status=msg;notify(true);};switch(action){
  case 'g-global-size':{if(!ALL_SIZES.includes(key))break;s.preferredServingSize=key;s.servingChoice={};s.status=`Recipe shelf set to ${SERVING_LABEL[key]}. Dishes that don't offer it keep their available size. Existing meal plan unchanged.`;notify(true);break;}
  case 'g-apply-plan-size':{const preferred=ALL_SIZES.includes(s.preferredServingSize)?s.preferredServingSize:'party';let changed=0,skipped=0;const combined=new Map();for(const p of s.plan){const r=getRecipe(s,p.id);if(!r)continue;const old=planSize(s,p);const target=sizesForRecipe(r).includes(preferred)?preferred:old;if(target!==old)changed++;else if(target!==preferred)skipped++;const lookup=`${p.id}|${target}`;if(combined.has(lookup))combined.get(lookup).batches=Math.min(100,combined.get(lookup).batches+Math.max(1,Math.floor(num(p.batches,1))));else combined.set(lookup,{id:p.id,size:target,batches:Math.max(1,Math.floor(num(p.batches,1)))});}s.plan=[...combined.values()];s.checked={};s.status=`Updated ${changed} planned meal${changed===1?'':'s'} to ${SERVING_SHORT[preferred]}; ${skipped} can't use that size. Unverified ingredient profiles remain flagged.`;notify(true);break;}
  case 'g-add':{const r=getRecipe(s,key);if(!r)break;const size=preferredSize(s,r);const found=s.plan.find(p=>p.id===key&&planSize(s,p)===size);if(found)found.batches=Math.min(100,Number(found.batches)+1);else s.plan.push({id:key,size,batches:1});saved(`Added ${r.name} — ${SERVING_LABEL[size]}.`);break;}
  case 'g-remove':s.plan=s.plan.filter(p=>entryKey(s,p)!==key);saved('Meal removed.');break;
  case 'g-clear-plan':if(s.plan.length&&confirm('Clear your current meal plan? Saved collections and pantry are safe.')){s.plan=[];s.checked={};saved('Menu cleared.');}break;
  case 'g-favorite':s.favorites=s.favorites.includes(key)?s.favorites.filter(x=>x!==key):[...s.favorites,key];notify(true);break;
  case 'g-copy':copy(s,saved);break;
  case 'g-download':download(s);saved('Shopping list downloaded.');break;
  case 'g-print':window.print();break;
  case 'g-clear-checked':s.checked={};notify(true);break;
  case 'g-add-pantry':{const typed=clean(s.addPantryName),q=Math.max(1,Math.floor(num(s.addPantryQty,1)));if(!typed){saved('Enter an ingredient name first.');break;}const known=[...new Set([...D.recipes.flatMap(r=>(r.ingredients||[]).map(i=>i.name)),...Object.values(D.verifiedServingSizes).flatMap(v=>Object.values(v).flatMap(w=>(w.ingredients||[]).map(i=>i.name))),...Object.keys(componentMap(s)),...D.defaultSubstitutions.flatMap(x=>x.options),
     'Bread','Strawberry','Mushroom',...Object.keys(s.pantry)])];const n=known.find(x=>x.toLowerCase()===typed.toLowerCase())||typed;s.pantry[n]=(s.pantry[n]||0)+q;s.addPantryName='';saved(`Added ${q} × ${n} to your pantry.`);break;}
  case 'g-save-collection':{const name=clean(s.collectionName);if(!name){saved('Give the collection a name first.');break;}if(!s.plan.length){saved('Add at least one meal before saving a collection.');break;}const prev=s.collections.find(c=>c.name.toLowerCase()===name.toLowerCase());if(prev){if(!confirm('Replace the saved collection with this menu?'))break;prev.items=s.plan.map(x=>({...x}));}else s.collections.push({id:'collection-'+id(),name,items:s.plan.map(x=>({...x}))});s.collectionName='';saved(`Saved meal collection “${name}”.`);break;}
  case 'g-load-preset':{const c=D.prebuiltCollections[Number(key)];if(!c)return;s.plan=c.items.filter(x=>getRecipe(s,x)).map(id=>({id,size:preferredSize(s,getRecipe(s,id)),batches:1}));s.checked={};saved(`Loaded ${c.name}.`);break;}
  case 'g-load-collection':{const c=s.collections.find(x=>x.id===key);if(!c)return;s.plan=c.items.filter(x=>getRecipe(s,x.id)).map(x=>({...x}));s.checked={};saved(`Loaded ${c.name}.`);break;}
  case 'g-delete-collection':if(confirm('Delete this saved meal collection?')){s.collections=s.collections.filter(x=>x.id!==key);saved('Collection deleted.');}break;
  case 'g-new-recipe':s.editor={id:'custom-'+id(),name:'',category:'Everyday',pack:'custom',level:1,ingredientsText:'',component:false,yield:5,sizeDraft:Object.fromEntries(ALL_SIZES.map(k=>[k,{ingredientsText:'',preppedText:''}]))};s.editing=null;notify(true);break;
  case 'g-edit':{const r=getRecipe(s,key)||(s.custom||[]).find(x=>x.id===key);if(!r)return;const sizeDraft={};for(const size of ALL_SIZES){const v=recipeVariant(s,r,size);sizeDraft[size]={ingredientsText:toLines(v?.ingredients||[]),preppedText:toLines(v?.prepped||[])};}s.editor={id:r.id,name:r.name,category:r.category||'Everyday',pack:r.pack||'custom',level:r.level||1,ingredientsText:toLines(r.ingredients),component:!!r.component,yield:r.yield||5,sizeDraft};s.editing=r.id;notify(true);break;}
  case 'g-cancel-edit':s.editor=null;s.editing=null;notify(true);break;
  case 'g-reset-recipe':delete s.overrides[key];s.editor=null;s.editing=null;saved('Original recipe restored.');break;
  case 'g-save-recipe':{const ed=s.editor;if(!ed)return;const name=clean(ed.name);if(!name){saved('Recipe name is required.');break;}
    const builtIn=D.recipes.some(r=>r.id===ed.id);
    const sizeRecipes={};for(const [size,v] of Object.entries(ed.sizeDraft||{})){const items=parseIngredientLines(v.ingredientsText);if(items.length)sizeRecipes[size]={ingredients:items,prepped:parseIngredientLines(v.preppedText)};}
    const ingred=ed.component?parseIngredientLines(ed.ingredientsText):[];
    if(ed.component&&!ingred.length){saved('Add at least one ingredient for the prep component.');break;}
    if(!ed.component&&!Object.keys(sizeRecipes).length){saved('Enter ingredients for at least one cooking size.');break;}
    const rec={id:ed.id,name,category:ed.category||'Everyday',pack:ed.pack||'custom',level:Math.max(1,Math.min(10,Math.floor(num(ed.level,1)))),ingredients:ed.component?ingred:(sizeRecipes.single?.ingredients||sizeRecipes.party?.ingredients||sizeRecipes.family?.ingredients||[]),prepped:null,sizeRecipes,component:!!ed.component,yield:Math.max(1,Math.floor(num(ed.yield,5)))};
    if(builtIn){s.overrides[ed.id]={category:rec.category,pack:rec.pack,level:rec.level,sizeRecipes};}
    else {const duplicate=D.recipes.some(r=>r.name.toLowerCase()===name.toLowerCase())&&!(s.custom||[]).some(x=>x.id===ed.id&&x.name===name);if(duplicate){saved('A built-in recipe already has that name. Edit that recipe instead.');break;}const i=s.custom.findIndex(x=>x.id===rec.id);if(i>=0)s.custom[i]=rec;else s.custom.push(rec);}
    s.editor=null;s.editing=null;saved(`Saved serving-size recipes for “${name}”.`);break;}
  case 'g-delete-custom':if(confirm('Delete this custom recipe?')){s.custom=s.custom.filter(x=>x.id!==key);s.plan=s.plan.filter(x=>x.id!==key);saved('Custom recipe deleted.');}break;
  default:break;
 }}
 function merge(a,b){const s=ensure(a),t=ensure(b);for(const c of t.collections){if(!s.collections.some(x=>x.id===c.id))s.collections.push(c);}for(const r of t.custom){if(!s.custom.some(x=>x.id===r.id))s.custom.push(r);}s.favorites=[...new Set([...s.favorites,...t.favorites])];s.pantry={...s.pantry,...t.pantry};s.overrides={...s.overrides,...t.overrides};s.substitutions={...s.substitutions,...t.substitutions};if(!s.plan.length&&t.plan.length){s.plan=t.plan.map(p=>({...p}));s.checked={...t.checked};s.usePrep=t.usePrep;}if(!a?.preferredServingSize&&t.preferredServingSize)s.preferredServingSize=t.preferredServingSize;return s;}
 return {ensure,render,action,updateInput,updateChange,merge,compute,pantryAssessment,sortedPantryRecipes,parseIngredientLines,useIcon};
})();
