/* SimStory Studio Grocery Planner • v4.5
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
 const starter={plan:[],collections:[],favorites:[],custom:[],overrides:{},pantry:{},checked:{},substitutions:{},usePrep:true,category:'All',search:'',collectionName:'',editor:null,editing:null,showPantry:false,showSubstitutions:false,status:'',addPantryName:'',addPantryQty:1,servingChoice:{}};
 const ensure=s=>({...starter,...(s&&typeof s==='object'?s:{}),plan:Array.isArray(s?.plan)?s.plan:[],collections:Array.isArray(s?.collections)?s.collections:[],favorites:Array.isArray(s?.favorites)?s.favorites:[],custom:Array.isArray(s?.custom)?s.custom:[],overrides:s?.overrides||{},pantry:s?.pantry||{},checked:s?.checked||{},substitutions:s?.substitutions||{},servingChoice:s?.servingChoice||{}});
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
   const grocery=Object.entries(raw).map(([name,needed])=>({name,needed,onHand:num(g.pantry[name]),toBuy:Math.max(0,needed-num(g.pantry[name]))})).sort((a,b)=>a.name.localeCompare(b.name));
   const distinct=grocery.filter(x=>x.toBuy>0).length;
   const total=grocery.reduce((a,x)=>a+x.toBuy,0);
   return {grocery,steps,problems,missing,distinct,total};
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
 function recipeCard(g,r){
   const sizes=sizesForRecipe(r),chosen=sizeOf(r,g.servingChoice?.[r.id]);
   const planned=g.plan.find(p=>p.id===r.id&&planSize(g,p)===chosen),favorite=g.favorites.includes(r.id);
   const variant=recipeVariant(g,r,chosen),items=recipeIngredients(g,r,chosen);
   const needsDetails=!variant;
   return `<article class="gp-recipe"><div class="gp-rec-head"><div class="gp-food-icon">${gameIcon('skill',r.category==='Gourmet'?'Gourmet Cooking':'Cooking',true)}</div><div class="gp-rec-title"><b>${esc(r.name)}</b><small>${esc(r.category)} · ${esc(r.skill||'Cooking')} ${Number(r.level)||1}</small></div><button class="gp-iconbutton ${favorite?'on':''}" title="${favorite?'Remove favorite':'Favorite this recipe'}" aria-label="Favorite ${esc(r.name)}" data-action="g-favorite" data-id="${esc(r.id)}">${favorite?'★':'☆'}</button></div><div class="gp-pack-row">${packIcon(r.pack)}</div><label class="gp-serving-label">Cook size<select class="gp-serving-select" data-g-change="recipeSize" data-id="${esc(r.id)}" aria-label="Select servings for ${esc(r.name)}">${sizes.map(k=>`<option value="${k}" ${k===chosen?'selected':''}>${SERVING_LABEL[k]}</option>`).join('')}</select></label><div class="gp-rec-ingredients">${needsDetails?'<span class="gp-unverified">Ingredients for this size not entered</span>':ingredientDescription(items)}</div>${variant?.source==='estimate'?'<small class="gp-detail-note">Starter estimate; confirm in your game.</small>':''}${r.notes?`<small class="gp-detail-note">${esc(r.notes)}</small>`:''}<div class="gp-rec-actions"><button class="btn tiny primary" data-action="g-add" data-id="${esc(r.id)}">${planned?'＋ Another cooking action':'＋ Add meal'}</button><button class="btn tiny" data-action="g-edit" data-id="${esc(r.id)}">Edit sizes</button></div></article>`;
 }

 function intro(s,owned){let recipes=allRecipes(s).filter(r=>r.pack==='base'||r.pack==='custom'||owned.includes(r.pack));
   const q=s.search.toLowerCase(); if(q)recipes=recipes.filter(r=>[r.name,r.category,r.pack,r.skill,...(r.ingredients||[]).map(x=>x.name)].join(' ').toLowerCase().includes(q));
   if(s.category==='Favorites')recipes=recipes.filter(r=>s.favorites.includes(r.id));else if(s.category!=='All')recipes=recipes.filter(r=>r.category===s.category);
   const counts=allRecipes(s).filter(r=>r.pack==='base'||r.pack==='custom'||owned.includes(r.pack));
   const tabs=['All','Favorites',...D.categories.filter(x=>x!=='All')];
   return `<section class="gp-card"><div class="gp-flex-heading"><div><div class="gp-heading-strap">01 / Pick your meals</div><h2>Recipe shelf</h2><p>Choose the dishes you actually want to cook. Choose the game’s serving size for each dish, then add as many cooking actions as you want.</p></div><div class="gp-stat">${counts.length}<span>available recipes</span></div></div><div class="gp-filters"><input class="searchinput" data-g-input="search" placeholder="Search meals or ingredients…" value="${esc(s.search)}" aria-label="Search recipes"/><select data-g-change="category" aria-label="Recipe category">${tabs.map(t=>`<option value="${esc(t)}" ${s.category===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div><div class="gp-recipe-grid">${recipes.map(r=>recipeCard(s,r)).join('')}${!recipes.length?'<div class="gp-empty">No recipes match those filters. You can add a custom recipe below.</div>':''}</div><p class="gp-footnote">Starter catalog based on community recipe guides, not a complete in-game database. Requirements may differ with game updates or mods.</p></section>`;}
 function planner(s){return `<section class="gp-card"><div class="gp-flex-heading"><div><div class="gp-heading-strap">02 / Menu for this shopping trip</div><h2>My meal plan</h2><p>Select Single (×1), Family (×4), or Party (×8). Sizes are game recipes—not ingredient multipliers.</p></div><button class="btn tiny" data-action="g-clear-plan">Clear plan</button></div>${s.plan.length?`<div class="gp-plan-list">${s.plan.map(p=>{const r=getRecipe(s,p.id);if(!r)return'';const size=planSize(s,p),key=entryKey(s,p);const missing=!recipeVariant(s,r,size);return `<div class="gp-plan-item"><div><b>${esc(r.name)}</b><small>${esc(r.category)} · ${packIcon(r.pack)}</small>${missing?'<small class="gp-unverified">Needs ingredient entry for this size</small>':''}</div><div class="gp-plan-controls"><label>Size<select class="gp-serving-select" data-g-change="planSize" data-id="${esc(key)}" aria-label="Serving size for ${esc(r.name)}">${sizesForRecipe(r).map(k=>`<option value="${k}" ${k===size?'selected':''}>${SERVING_LABEL[k]}</option>`).join('')}</select></label><label>Make <input type="number" min="1" max="100" step="1" value="${Math.max(1,Math.floor(num(p.batches,1)))}" data-g-change="batches" data-id="${esc(key)}" aria-label="Cooking actions for ${esc(r.name)}"/></label><button class="gp-iconbutton" data-action="g-remove" data-id="${esc(key)}" title="Remove meal" aria-label="Remove ${esc(r.name)}">×</button></div></div>`}).join('')}</div>`:'<div class="gp-empty">Your list is empty. Add a few meals from the Recipe Shelf.</div>'}<div class="gp-toggle"><label><input type="checkbox" data-g-change="prep" ${s.usePrep?'checked':''}/> <b>Use Home Chef Hustle prepped ingredients</b></label><small>${s.usePrep?'Known stand-mixer ingredients are expanded into raw materials, with five portions per batch.':'Direct ingredients are used where available; no stand-mixer components substituted automatically.'}</small></div><div class="gp-saved"><h3>Save & reuse meal collections</h3><div class="gp-save-row"><input data-g-input="collectionName" maxlength="80" placeholder="e.g. My family dinners" value="${esc(s.collectionName)}"/><button class="btn tiny primary" data-action="g-save-collection">Save this menu</button></div><div class="gp-collections">${D.prebuiltCollections.map((c,i)=>`<div class="gp-collection"><span>${esc(c.name)} <small>suggested</small></span><button class="btn tiny" data-action="g-load-preset" data-id="${i}">Use</button></div>`).join('')}${savedPlans(s).map(c=>`<div class="gp-collection"><span>${esc(c.name)} <small>${c.items.length} meals</small></span><div><button class="btn tiny" data-action="g-load-collection" data-id="${esc(c.id)}">Load</button><button class="gp-iconbutton" data-action="g-delete-collection" data-id="${esc(c.id)}" title="Delete collection">×</button></div></div>`).join('')}</div></div></section>`;}

 function shopRow(s,x){
   const have=x.onHand>0?` · Have ${fmt(x.onHand)}`:'';
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
  case 'g-add':{const r=getRecipe(s,key);if(!r)break;const size=sizeOf(r,s.servingChoice?.[key]);const found=s.plan.find(p=>p.id===key&&planSize(s,p)===size);if(found)found.batches=Math.min(100,Number(found.batches)+1);else s.plan.push({id:key,size,batches:1});saved(`Added ${r.name} — ${SERVING_LABEL[size]}.`);break;}
  case 'g-remove':s.plan=s.plan.filter(p=>entryKey(s,p)!==key);saved('Meal removed.');break;
  case 'g-clear-plan':if(s.plan.length&&confirm('Clear your current meal plan? Saved collections and pantry are safe.')){s.plan=[];s.checked={};saved('Menu cleared.');}break;
  case 'g-favorite':s.favorites=s.favorites.includes(key)?s.favorites.filter(x=>x!==key):[...s.favorites,key];notify(true);break;
  case 'g-copy':copy(s,saved);break;
  case 'g-download':download(s);saved('Shopping list downloaded.');break;
  case 'g-print':window.print();break;
  case 'g-clear-checked':s.checked={};notify(true);break;
  case 'g-add-pantry':{const n=clean(s.addPantryName),q=Math.max(1,Math.floor(num(s.addPantryQty,1)));if(!n){saved('Enter an ingredient name first.');break;}s.pantry[n]=(s.pantry[n]||0)+q;s.addPantryName='';saved(`Added ${q} × ${n} to your pantry.`);break;}
  case 'g-save-collection':{const name=clean(s.collectionName);if(!name){saved('Give the collection a name first.');break;}if(!s.plan.length){saved('Add at least one meal before saving a collection.');break;}const prev=s.collections.find(c=>c.name.toLowerCase()===name.toLowerCase());if(prev){if(!confirm('Replace the saved collection with this menu?'))break;prev.items=s.plan.map(x=>({...x}));}else s.collections.push({id:'collection-'+id(),name,items:s.plan.map(x=>({...x}))});s.collectionName='';saved(`Saved meal collection “${name}”.`);break;}
  case 'g-load-preset':{const c=D.prebuiltCollections[Number(key)];if(!c)return;s.plan=c.items.filter(x=>getRecipe(s,x)).map(id=>({id,size:defaultSize(getRecipe(s,id)),batches:1}));s.checked={};saved(`Loaded ${c.name}.`);break;}
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
 function merge(a,b){const s=ensure(a),t=ensure(b);for(const c of t.collections){if(!s.collections.some(x=>x.id===c.id))s.collections.push(c);}for(const r of t.custom){if(!s.custom.some(x=>x.id===r.id))s.custom.push(r);}s.favorites=[...new Set([...s.favorites,...t.favorites])];s.pantry={...s.pantry,...t.pantry};s.overrides={...s.overrides,...t.overrides};s.substitutions={...s.substitutions,...t.substitutions};if(!s.plan.length&&t.plan.length){s.plan=t.plan.map(p=>({...p}));s.checked={...t.checked};s.usePrep=t.usePrep;}return s;}
 return {ensure,render,action,updateInput,updateChange,merge,compute,parseIngredientLines,useIcon};
})();
