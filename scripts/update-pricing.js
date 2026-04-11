#!/usr/bin/env node
/**
 * update-pricing.js
 * Updates pricing in both Cloudflare workers:
 *  1. landing.js — pricing cards, currency toggle, checkout modal, JS functions
 *  2. license-server.js — plan constants, createOrder handler, download page
 */
'use strict'
const fs = require('fs')
const path = require('path')

const WORKER_DIR = path.join(__dirname, '..', 'cloudflare-worker')
const LANDING    = path.join(WORKER_DIR, 'landing.js')
const LICENSE    = path.join(WORKER_DIR, 'license-server.js')

// Helper: in landing.js the HTML is stored as an escaped JS string
// (real " → \" in file, real \n → \n literal in file).
// This escapes a normal HTML/JS string into that format.
function esc(html) {
  return html
    .replace(/\\/g, '\\\\')   // backslashes first
    .replace(/"/g, '\\"')     // double-quotes
    .replace(/\n/g, '\\n')    // newlines
}

// ─── NEW HTML FRAGMENTS ────────────────────────────────────────

const NEW_PRICING_GRID = `
    <!-- Launch Banner -->
    <div style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.35);border-radius:10px;padding:14px 24px;margin:0 auto 24px;max-width:900px;text-align:center">
      <span style="font-family:var(--mono);font-size:13px;color:var(--orange);font-weight:700">&#x1F680; Launch Offer:</span>
      <span style="font-family:var(--mono);font-size:13px;color:var(--text)"> First 100 Pro users get </span>
      <span id="launchPriceBanner" style="font-family:var(--mono);font-size:13px;color:var(--orange);font-weight:700">$6/month</span>
      <span style="font-family:var(--mono);font-size:13px;color:var(--text)"> locked forever</span>
      <span style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-left:12px">&#183; Limited spots</span>
    </div>

    <!-- Currency Toggle -->
    <div style="display:flex;gap:6px;justify-content:center;margin:0 auto 28px">
      <button id="cur_USD" onclick="setCurrency('USD')" style="padding:6px 14px;font-family:var(--mono);font-size:12px;border-radius:6px;cursor:pointer;background:var(--odim);border:1px solid var(--orange);color:var(--orange)">$ USD</button>
      <button id="cur_INR" onclick="setCurrency('INR')" style="padding:6px 14px;font-family:var(--mono);font-size:12px;border-radius:6px;cursor:pointer;background:var(--bg2);border:1px solid var(--b);color:var(--muted2)">&#8377; INR</button>
      <button id="cur_EUR" onclick="setCurrency('EUR')" style="padding:6px 14px;font-family:var(--mono);font-size:12px;border-radius:6px;cursor:pointer;background:var(--bg2);border:1px solid var(--b);color:var(--muted2)">&#8364; EUR</button>
      <button id="cur_GBP" onclick="setCurrency('GBP')" style="padding:6px 14px;font-family:var(--mono);font-size:12px;border-radius:6px;cursor:pointer;background:var(--bg2);border:1px solid var(--b);color:var(--muted2)">&#163; GBP</button>
    </div>

    <!-- Pricing cards: Free | Pro Monthly | Pro Annual -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;max-width:900px;margin:0 auto 48px">

      <!-- Free Plan -->
      <div style="background:var(--bg1);border:1px solid var(--b);border-radius:16px;padding:32px 24px">
        <div style="font-family:var(--mono);font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">Free Plan</div>
        <div style="font-family:var(--mono);font-size:40px;font-weight:800;color:var(--text);line-height:1;margin-bottom:4px">$0</div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:24px">forever</div>
        <ul style="list-style:none;padding:0;margin:0 0 28px;display:flex;flex-direction:column;gap:10px">
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--green);flex-shrink:0">&#10003;</span>All 44 features + 31 agents</li>
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--green);flex-shrink:0">&#10003;</span>100 AI credits / day</li>
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--green);flex-shrink:0">&#10003;</span>Unlimited local Ollama</li>
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--green);flex-shrink:0">&#10003;</span>Full memory + skills</li>
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--green);flex-shrink:0">&#10003;</span>2 machines</li>
        </ul>
        <button onclick="showDownload()" class="btnp" style="width:100%;font-size:14px;padding:12px">Download Free &#8594;</button>
      </div>

      <!-- Pro Monthly -->
      <div style="background:var(--bg1);border:2px solid rgba(249,115,22,0.5);border-radius:16px;padding:32px 24px;position:relative">
        <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--orange);color:#000;font-family:var(--mono);font-size:10px;font-weight:700;padding:4px 14px;border-radius:20px;white-space:nowrap">LAUNCH OFFER</div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--orange);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">Pro Monthly</div>
        <div style="font-family:var(--mono);line-height:1;margin-bottom:4px">
          <span style="font-size:28px;font-weight:800;color:var(--muted);text-decoration:line-through" id="pMstrike">$9</span>
          <span style="font-size:40px;font-weight:800;color:var(--text)" id="pMLaunch"> $6</span>
        </div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:24px">per month &#183; first 100 users</div>
        <ul style="list-style:none;padding:0;margin:0 0 28px;display:flex;flex-direction:column;gap:10px">
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--orange);flex-shrink:0">&#10003;</span>Everything in Free</li>
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--orange);flex-shrink:0">&#10003;</span><strong style="color:var(--text)">Unlimited</strong> AI credits</li>
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--orange);flex-shrink:0">&#10003;</span>Priority support</li>
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--orange);flex-shrink:0">&#10003;</span>Early access to new features</li>
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--orange);flex-shrink:0">&#10003;</span>Cancel anytime</li>
        </ul>
        <button onclick="startCheckout('launch')" class="btnp" style="width:100%;font-size:14px;padding:12px">Get Launch Price &#8594;</button>
      </div>

      <!-- Pro Annual (BEST VALUE) -->
      <div style="background:var(--bg1);border:2px solid var(--orange);border-radius:16px;padding:32px 24px;position:relative">
        <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--orange);color:#000;font-family:var(--mono);font-size:10px;font-weight:700;padding:4px 14px;border-radius:20px;white-space:nowrap">BEST VALUE</div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--orange);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">Pro Annual</div>
        <div style="font-family:var(--mono);line-height:1;margin-bottom:4px">
          <span style="font-size:40px;font-weight:800;color:var(--text)" id="pAnnual">$72</span>
        </div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:4px"><span id="pAnnualEff">$6/month</span> effective &#183; <span style="color:var(--green);font-weight:700">Save 33%</span></div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:20px">billed annually</div>
        <ul style="list-style:none;padding:0;margin:0 0 28px;display:flex;flex-direction:column;gap:10px">
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--orange);flex-shrink:0">&#10003;</span>Everything in Free</li>
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--orange);flex-shrink:0">&#10003;</span><strong style="color:var(--text)">Unlimited</strong> AI credits</li>
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--orange);flex-shrink:0">&#10003;</span>Priority support</li>
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--orange);flex-shrink:0">&#10003;</span>Early access to new features</li>
          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px"><span style="color:var(--orange);flex-shrink:0">&#10003;</span>Best value &#183; 12 months</li>
        </ul>
        <button onclick="startCheckout('annual')" class="btnp" style="width:100%;font-size:14px;padding:12px">Get Annual &#8594;</button>
      </div>

    </div>`

const NEW_CHECKOUT_MODAL = `<div id="checkoutModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:999;align-items:center;justify-content:center;padding:20px">
      <div style="background:var(--bg1);border:1px solid var(--b);border-radius:16px;padding:36px;max-width:460px;width:100%;position:relative">
        <button onclick="closeCheckout()" style="position:absolute;top:16px;right:16px;background:none;border:none;color:var(--muted);font-size:24px;cursor:pointer;line-height:1">&times;</button>
        <div style="font-family:var(--mono);font-size:10px;color:var(--orange);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">Upgrade to Pro</div>
        <h3 id="modalTitle" style="font-size:20px;font-weight:700;margin-bottom:4px">Aiden Pro &mdash; $6/month</h3>
        <p id="modalSubtitle" style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:20px">Launch offer &middot; First 100 users &middot; Locked forever</p>

        <!-- Plan selector -->
        <div style="display:flex;gap:6px;margin-bottom:20px">
          <button id="planLaunch" onclick="selectPlan('launch')" style="flex:1;padding:8px 4px;font-family:var(--mono);font-size:11px;border-radius:6px;cursor:pointer;background:var(--odim);border:1px solid var(--orange);color:var(--orange)">Launch $6/mo</button>
          <button id="planMonthly" onclick="selectPlan('monthly')" style="flex:1;padding:8px 4px;font-family:var(--mono);font-size:11px;border-radius:6px;cursor:pointer;background:var(--bg2);border:1px solid var(--b);color:var(--muted2)">Monthly $9/mo</button>
          <button id="planAnnual" onclick="selectPlan('annual')" style="flex:1;padding:8px 4px;font-family:var(--mono);font-size:11px;border-radius:6px;cursor:pointer;background:var(--bg2);border:1px solid var(--b);color:var(--muted2)">Annual $72/yr</button>
        </div>

        <div style="margin-bottom:16px">
          <label style="font-family:var(--mono);font-size:11px;color:var(--muted2);display:block;margin-bottom:6px">Email</label>
          <input id="proEmail" type="email" placeholder="your@email.com" style="width:100%;background:var(--bg2);border:1px solid var(--b2);border-radius:6px;padding:10px 14px;font-family:var(--mono);font-size:13px;color:var(--text);outline:none;">
        </div>
        <div style="margin-bottom:20px">
          <label style="font-family:var(--mono);font-size:11px;color:var(--muted2);display:block;margin-bottom:8px">Currency</label>
          <div style="display:flex;gap:6px">
            <button id="btnUSD" onclick="setCurrency('USD')" style="flex:1;padding:7px 4px;font-family:var(--mono);font-size:11px;border-radius:6px;cursor:pointer;background:var(--odim);border:1px solid var(--orange);color:var(--orange)">$ USD</button>
            <button id="btnINR" onclick="setCurrency('INR')" style="flex:1;padding:7px 4px;font-family:var(--mono);font-size:11px;border-radius:6px;cursor:pointer;background:var(--bg2);border:1px solid var(--b);color:var(--muted2)">&#8377; INR</button>
            <button id="btnEUR" onclick="setCurrency('EUR')" style="flex:1;padding:7px 4px;font-family:var(--mono);font-size:11px;border-radius:6px;cursor:pointer;background:var(--bg2);border:1px solid var(--b);color:var(--muted2)">&#8364; EUR</button>
            <button id="btnGBP" onclick="setCurrency('GBP')" style="flex:1;padding:7px 4px;font-family:var(--mono);font-size:11px;border-radius:6px;cursor:pointer;background:var(--bg2);border:1px solid var(--b);color:var(--muted2)">&#163; GBP</button>
          </div>
        </div>
        <button id="payBtn" onclick="initiatePayment()" class="btnp" style="width:100%;font-size:14px;padding:14px">Pay with GPay / UPI / Card &#8594;</button>
        <p style="font-family:var(--mono);font-size:10px;color:var(--muted);text-align:center;margin-top:12px">Secured by Razorpay &middot; All payment methods</p>
        <div id="payError" style="display:none;font-family:var(--mono);font-size:11px;color:#f87171;text-align:center;margin-top:8px"></div>
      </div>
    </div>`

const NEW_JS_FUNCTIONS = `var selectedCurrency='USD';
var selectedPlan='launch';

var PRICES={
  USD:{launch:{amount:600,label:'$6/month',desc:'Launch offer \u00B7 First 100 users \u00B7 Locked forever'},monthly:{amount:900,label:'$9/month',desc:'Unlimited credits \u00B7 Cancel anytime'},annual:{amount:7200,label:'$72/year',desc:'$6/month effective \u00B7 Save 33%'}},
  INR:{launch:{amount:49900,label:'\u20B9499/month',desc:'Launch offer \u00B7 First 100 users \u00B7 Locked forever'},monthly:{amount:74900,label:'\u20B9749/month',desc:'Unlimited credits \u00B7 Cancel anytime'},annual:{amount:599900,label:'\u20B95,999/year',desc:'\u20B9500/month effective \u00B7 Save 33%'}},
  EUR:{launch:{amount:500,label:'\u20AC5/month',desc:'Launch offer \u00B7 First 100 users \u00B7 Locked forever'},monthly:{amount:800,label:'\u20AC8/month',desc:'Unlimited credits \u00B7 Cancel anytime'},annual:{amount:6700,label:'\u20AC67/year',desc:'\u20AC6/month effective \u00B7 Save 33%'}},
  GBP:{launch:{amount:400,label:'\u00A34/month',desc:'Launch offer \u00B7 First 100 users \u00B7 Locked forever'},monthly:{amount:700,label:'\u00A37/month',desc:'Unlimited credits \u00B7 Cancel anytime'},annual:{amount:5800,label:'\u00A358/year',desc:'\u00A35/month effective \u00B7 Save 33%'}}
};

function setCurrency(cur){
  selectedCurrency=cur;
  var all=['USD','INR','EUR','GBP'];
  all.forEach(function(c){
    var active=c===cur;
    var btnPage=document.getElementById('cur_'+c);
    var btnModal=document.getElementById('btn'+c);
    [btnPage,btnModal].forEach(function(el){
      if(!el)return;
      el.style.background=active?'var(--odim)':'var(--bg2)';
      el.style.borderColor=active?'var(--orange)':'var(--b)';
      el.style.color=active?'var(--orange)':'var(--muted2)';
    });
  });
  updatePricingDisplay();
}

function updatePricingDisplay(){
  var p=PRICES[selectedCurrency]||PRICES.USD;
  var el;
  // Banner
  if((el=document.getElementById('launchPriceBanner')))el.textContent=p.launch.label;
  // Pro Monthly card
  var strikeMap={USD:'$9',INR:'\u20B9749',EUR:'\u20AC8',GBP:'\u00A37'};
  if((el=document.getElementById('pMstrike')))el.textContent=strikeMap[selectedCurrency]||strikeMap.USD;
  if((el=document.getElementById('pMLaunch')))el.textContent=' '+p.launch.label.split('/')[0];
  // Pro Annual card
  var annualMap={USD:'$72',INR:'\u20B95,999',EUR:'\u20AC67',GBP:'\u00A358'};
  var annEffMap={USD:'$6/month',INR:'\u20B9500/month',EUR:'\u20AC6/month',GBP:'\u00A35/month'};
  if((el=document.getElementById('pAnnual')))el.textContent=annualMap[selectedCurrency]||annualMap.USD;
  if((el=document.getElementById('pAnnualEff')))el.textContent=annEffMap[selectedCurrency]||annEffMap.USD;
  // Update modal plan tabs too
  selectPlan(selectedPlan,true);
}

function selectPlan(plan,noScroll){
  selectedPlan=plan;
  var plans=['launch','monthly','annual'];
  plans.forEach(function(p){
    var btn=document.getElementById('plan'+p.charAt(0).toUpperCase()+p.slice(1));
    if(!btn)return;
    var active=p===plan;
    btn.style.background=active?'var(--odim)':'var(--bg2)';
    btn.style.borderColor=active?'var(--orange)':'var(--b)';
    btn.style.color=active?'var(--orange)':'var(--muted2)';
  });
  var pr=PRICES[selectedCurrency]||PRICES.USD;
  var info=pr[plan]||pr.launch;
  var titleEl=document.getElementById('modalTitle');
  var subEl=document.getElementById('modalSubtitle');
  if(titleEl)titleEl.textContent='Aiden Pro \u2014 '+info.label;
  if(subEl)subEl.textContent=info.desc;
}

function startCheckout(plan){
  selectPlan(plan||'launch');
  document.getElementById('checkoutModal').style.display='flex';
}
function closeCheckout(){document.getElementById('checkoutModal').style.display='none';}

async function initiatePayment(){
  var email=document.getElementById('proEmail').value.trim().toLowerCase();
  var errEl=document.getElementById('payError');
  var btn=document.getElementById('payBtn');
  errEl.style.display='none';
  if(!email||!email.includes('@')){errEl.textContent='Please enter a valid email.';errEl.style.display='block';return;}
  btn.textContent='Creating order...';btn.disabled=true;
  var cur=selectedCurrency;
  // EUR/GBP route through USD (Razorpay handles conversion)
  var payCur=(cur==='INR')?'INR':'USD';
  var priceInfo=PRICES[cur][selectedPlan]||PRICES.USD[selectedPlan];
  var usdInfo=PRICES.USD[selectedPlan];
  var payAmount=(cur==='INR')?priceInfo.amount:usdInfo.amount;
  try{
    var r=await fetch('https://api.taracod.com/payment/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,currency:payCur,plan:selectedPlan,amount:payAmount})});
    var order=await r.json();
    if(!order.orderId){errEl.textContent='Could not create order. Try again.';errEl.style.display='block';btn.textContent='Pay with GPay / UPI / Card \u2192';btn.disabled=false;return;}
    var options={
      key:order.keyId,amount:order.amount,currency:order.currency,
      name:'Aiden Pro',description:priceInfo.desc,
      order_id:order.orderId,prefill:{email:email},
      theme:{color:'#f97316'},
      handler:async function(resp){
        btn.textContent='Verifying...';
        var vr=await fetch('https://api.taracod.com/payment/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({razorpay_order_id:resp.razorpay_order_id,razorpay_payment_id:resp.razorpay_payment_id,razorpay_signature:resp.razorpay_signature,email:email,plan:selectedPlan})});
        var vd=await vr.json();
        if(vd.success){
          closeCheckout();
          alert('Pro activated! License key sent to '+email+'. Open Aiden \u2192 Settings \u2192 Pro License \u2192 paste key.');
        }else{
          errEl.textContent='Verification failed. Email hello@taracod.com';
          errEl.style.display='block';
          btn.textContent='Pay with GPay / UPI / Card \u2192';btn.disabled=false;
        }
      }
    };
    if(!window.Razorpay){
      await new Promise(function(res,rej){var s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    }
    var rzp=new window.Razorpay(options);
    rzp.on('payment.failed',function(resp){errEl.textContent='Payment failed: '+resp.error.description;errEl.style.display='block';});
    rzp.open();
    btn.textContent='Pay with GPay / UPI / Card \u2192';btn.disabled=false;
  }catch(err){
    errEl.textContent='Something went wrong. Try again.';errEl.style.display='block';
    btn.textContent='Pay with GPay / UPI / Card \u2192';btn.disabled=false;
  }
}`

// ─── TRANSFORM LANDING.JS ──────────────────────────────────────

console.log('\n═══ Patching landing.js ═══')
let landing = fs.readFileSync(LANDING, 'utf8')

// 1. Pricing grid (92735-96770 in original, find dynamically)
const gridSearchKey = 'gap:12px;max-width:720px;margin:0 auto 48px'
const gridDivStart  = landing.lastIndexOf('<div style=', landing.indexOf(gridSearchKey))
const pricingEnd    = landing.indexOf('downloadBox', gridDivStart)
// Find the last </div> before downloadBox
let searchPos = pricingEnd - 1
while (searchPos > gridDivStart && landing.slice(searchPos, searchPos + 6) !== '</div>') searchPos--
const gridEnd = searchPos + 6

const oldGrid = landing.slice(gridDivStart, gridEnd)
console.log('  grid found: chars', gridDivStart, '→', gridEnd, '(', oldGrid.length, 'chars)')

landing = landing.slice(0, gridDivStart) + esc(NEW_PRICING_GRID) + landing.slice(gridEnd)
console.log('  ✅ pricing grid replaced')

// 2. Checkout modal (find by checkoutModal ID, ends before next ctarow)
const modalSearchStart = landing.indexOf('checkoutModal') - 5
const ctarowAfterModal = landing.indexOf('<div class=', landing.indexOf('discord.gg') - 100)
const modalEnd2 = ctarowAfterModal  // modal ends just before ctarow

const oldModal = landing.slice(modalSearchStart, modalEnd2)
console.log('  modal found: chars', modalSearchStart, '→', modalEnd2, '(', oldModal.length, 'chars)')

landing = landing.slice(0, modalSearchStart) + esc(NEW_CHECKOUT_MODAL) + landing.slice(modalEnd2)
console.log('  ✅ checkout modal replaced')

// 3. JS functions (selectedCurrency through end of initiatePayment)
const jsFnStart = landing.indexOf('var selectedCurrency=')
const jsFnEnd   = landing.indexOf('document.addEventListener', jsFnStart)

landing = landing.slice(0, jsFnStart) + esc(NEW_JS_FUNCTIONS) + '\\n\\n' + landing.slice(jsFnEnd)
console.log('  ✅ JS functions replaced')

// 4. UTF-8: verify all HTML responses have charset
// (landing already had charset=UTF-8 everywhere — confirm no plain text/html)
const badHeaders = (landing.match(/'Content-Type':\s*'text\/html'/g) || []).length
console.log('  UTF-8 check: plain text/html headers =', badHeaders, badHeaders === 0 ? '✅' : '❌ fix needed')

fs.writeFileSync(LANDING, landing)
console.log('  ✅ landing.js saved')

// ─── TRANSFORM LICENSE-SERVER.JS ──────────────────────────────

console.log('\n═══ Patching license-server.js ═══')
let lic = fs.readFileSync(LICENSE, 'utf8')

// 1. Update plan constants
lic = lic.replace(
  /const PRO_PLAN_INR = 499\s*\/\/ .*\nconst PRO_PLAN_USD = 6\s*\/\/ .*/,
  `const PRO_PLAN_INR         = 749    // ₹749/month (regular)\nconst PRO_PLAN_USD         = 9      // $9/month (regular)\nconst PRO_PLAN_INR_ANNUAL  = 5999   // ₹5,999/year\nconst PRO_PLAN_USD_ANNUAL  = 72     // $72/year\nconst LAUNCH_PLAN_INR      = 499    // ₹499/month (first 100 users)\nconst LAUNCH_PLAN_USD      = 6      // $6/month (first 100 users)`
)
console.log('  ✅ plan constants updated')

// 2. Update handleCreateOrder to support plan param
lic = lic.replace(
  `  const amount = currency === 'INR'
    ? PRO_PLAN_INR * 100
    : PRO_PLAN_USD * 100`,
  `  const plan = body.plan || 'monthly'  // 'launch' | 'monthly' | 'annual'
  let inrAmount, usdAmount
  if (plan === 'annual') {
    inrAmount = PRO_PLAN_INR_ANNUAL * 100
    usdAmount = PRO_PLAN_USD_ANNUAL * 100
  } else if (plan === 'launch') {
    inrAmount = LAUNCH_PLAN_INR * 100
    usdAmount = LAUNCH_PLAN_USD * 100
  } else {
    inrAmount = PRO_PLAN_INR * 100
    usdAmount = PRO_PLAN_USD * 100
  }
  const amount = currency === 'INR' ? inrAmount : usdAmount`
)
console.log('  ✅ handleCreateOrder updated')

// 3. Fix upgrade link in email template
lic = lic.replace(
  `Upgrade to Pro — ₹499/month`,
  `Upgrade to Pro — from ₹499/month`
)
console.log('  ✅ email upgrade link updated')

// 4. Update download page Pro plan pricing section
lic = lic.replace(
  `        Unlimited credits<br>
        Priority support<br>
        Future Pro features<br>
        <a href="https://aiden.taracod.com/#pro"
          style="color:#f97316;font-weight:700;">
          ₹499/month →
        </a>`,
  `        Unlimited credits<br>
        Priority support<br>
        Future Pro features<br>
        <a href="https://aiden.taracod.com/#pro"
          style="color:#f97316;font-weight:700;">
          From $6/month — ₹499/month →
        </a>`
)
console.log('  ✅ download page Pro section updated')

// 5. UTF-8 check: all HTML responses should have charset
const badLicHeaders = (lic.match(/'Content-Type':\s*'text\/html'(?!;)/g) || []).length
console.log('  UTF-8 check: plain text/html headers =', badLicHeaders, badLicHeaders === 0 ? '✅' : '❌')

fs.writeFileSync(LICENSE, lic)
console.log('  ✅ license-server.js saved')

console.log('\n═══ Done — deploy with wrangler ═══\n')
