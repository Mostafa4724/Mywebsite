/* Shared product-variant UI for admin Add/Edit pages. */
(function(){
  "use strict";
  const list=document.getElementById("variantsList");
  if(!list) return;
  const addBtn=document.getElementById("addVariantBtn");
  let seq=0;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  function id(){ seq++; return "v-"+Date.now().toString(36)+"-"+seq; }
  function row(v={}){
    const vid=String(v.id||id());
    const sizes=Array.isArray(v.sizes)?v.sizes.slice(0,7):[];
    const n=Math.max(1,Math.min(7,sizes.length||1));
    const el=document.createElement("div"); el.className="variant-editor"; el.dataset.variantId=vid;
    el.innerHTML=`
      <div class="variant-editor-head"><strong>Color Variant</strong><button type="button" class="variant-remove">Remove</button></div>
      <div class="variant-top-grid">
        <label>Color<input class="variant-color" type="text" value="${esc(v.color||"")}" placeholder="e.g. Red"></label>
        <label>Stock Quantity<input class="variant-stock" type="number" min="0" value="${Number(v.stock||0)}"></label>
        <label>Number of Sizes<select class="variant-size-count">${Array.from({length:7},(_,i)=>`<option value="${i+1}" ${i+1===n?"selected":""}>${i+1}</option>`).join("")}</select></label>
      </div>
      <div class="variant-image-area">
        <label class="variant-image-label">Color Image</label>
        <div class="variant-image-row">
          <div class="variant-image-preview">${v.image?`<img src="${API}/uploads/products/${esc(v.image)}" alt="${esc(v.color||"Color")}">`:`<span>No image</span>`}</div>
          <label class="variant-file-button">Upload Image<input class="variant-image" type="file" accept="image/png,image/jpeg,image/webp" name="variant_image_${esc(vid)}"></label>
          <button type="button" class="variant-clear-image">Clear</button>
        </div>
        <input type="hidden" class="variant-existing-image" value="${esc(v.image||"")}">
      </div>
      <div class="variant-sizes"><div class="variant-sizes-title">Sizes & Prices</div><div class="variant-size-grid"></div></div>`;
    const grid=el.querySelector(".variant-size-grid"), select=el.querySelector(".variant-size-count");
    function renderSizes(){
      const count=Number(select.value); const old=[...el.querySelectorAll(".variant-size-row")].map(r=>({size:r.querySelector(".variant-size").value,price:r.querySelector(".variant-price").value}));
      grid.innerHTML="";
      for(let i=0;i<count;i++){
        const d=sizes[i]||old[i]||{};
        const r=document.createElement("div"); r.className="variant-size-row";
        r.innerHTML=`<label>Size<input class="variant-size" type="text" value="${esc(d.size||"")}" placeholder="e.g. M"></label><label>Price<input class="variant-price" type="number" min="0" step="0.01" value="${d.price??""}" placeholder="0.00"></label>`;
        grid.appendChild(r);
      }
    }
    select.addEventListener("change",renderSizes); renderSizes();
    el.querySelector(".variant-image").addEventListener("change",e=>{const f=e.target.files[0]; if(!f)return; const img=el.querySelector(".variant-image-preview"); img.innerHTML=""; const im=document.createElement("img"); im.src=URL.createObjectURL(f); img.appendChild(im); el.querySelector(".variant-existing-image").value="";});
    el.querySelector(".variant-clear-image").addEventListener("click",()=>{el.querySelector(".variant-image").value="";el.querySelector(".variant-existing-image").value="";el.querySelector(".variant-image-preview").innerHTML="<span>No image</span>";});
    el.querySelector(".variant-remove").addEventListener("click",()=>el.remove());
    return el;
  }
  window.ProductVariants={
    add(v){const e=row(v);list.appendChild(e);return e;},
    clear(){list.innerHTML="";},
    load(vs){list.innerHTML="";(Array.isArray(vs)?vs:[]).forEach(v=>list.appendChild(row(v)));},
    collect(){return [...list.querySelectorAll(".variant-editor")].map(el=>({
      id:el.dataset.variantId,color:el.querySelector(".variant-color").value.trim(),stock:Math.max(0,Number(el.querySelector(".variant-stock").value)||0),image:el.querySelector(".variant-existing-image").value||"",sizes:[...el.querySelectorAll(".variant-size-row")].map(r=>({size:r.querySelector(".variant-size").value.trim(),price:Math.max(0,Number(r.querySelector(".variant-price").value)||0)})).filter(x=>x.size)
    })).filter(v=>v.color);},
    appendToFormData(fd){const variants=this.collect(); fd.append("variant_data",JSON.stringify(variants)); for(const el of list.querySelectorAll(".variant-editor")){const f=el.querySelector(".variant-image"); if(f&&f.files[0]) fd.append(f.name,f.files[0]);} return variants;}
  };
  addBtn?.addEventListener("click",()=>ProductVariants.add());
  // On Add page start empty. On Edit page edit-product.js calls load().
})();
