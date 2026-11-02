/* Shared pagination component. Include pagination.css alongside this file. */
class PrototypePagination {
 static nextId=0;
 constructor(root,{total=0,page=1,pageSize=10,pageSizes=[10,20,50,100],onChange=()=>{}}={}){
  this.root=root;this.sizes=pageSizes;this.onChange=onChange;this.id='prototype-page-'+(++PrototypePagination.nextId);this.setState({total,page,pageSize});
 }
 setState({total=this.total,page=this.page,pageSize=this.pageSize}={}){
  this.total=Math.max(0,Math.floor(Number(total)||0));this.pageSize=this.sizes.includes(Number(pageSize))?Number(pageSize):this.sizes[0];this.pages=Math.max(1,Math.ceil(this.total/this.pageSize));this.page=Math.max(1,Math.min(this.pages,Math.floor(Number(page)||1)));this.render();
 }
 move(page,pageSize=this.pageSize){this.setState({page,pageSize});this.onChange({page:this.page,pageSize:this.pageSize})}
 pageItems(){if(this.pages<=7)return Array.from({length:this.pages},(_,i)=>i+1);const selected=new Set([1,this.pages,this.page-1,this.page,this.page+1]);if(this.page<=3)[2,3,4,5].forEach(n=>selected.add(n));if(this.page>=this.pages-2)[this.pages-4,this.pages-3,this.pages-2,this.pages-1].forEach(n=>selected.add(n));const values=[...selected].filter(n=>n>0&&n<=this.pages).sort((a,b)=>a-b),result=[];values.forEach((n,i)=>{if(i&&n-values[i-1]>1)result.push('…');result.push(n)});return result}
 render(){
  const empty=this.total===0;
  this.root.innerHTML=`<nav class="prototype-pagination" aria-label="表格分页"><span class="pp-total">共 ${this.total} 条</span><select class="pp-size" aria-label="每页条数">${this.sizes.map(n=>`<option value="${n}" ${n===this.pageSize?'selected':''}>${n}条/页</option>`).join('')}</select><div class="pp-pages"><button type="button" class="pp-arrow" data-prev aria-label="上一页" ${this.page===1||empty?'disabled':''}>‹</button>${this.pageItems().map(n=>typeof n==='number'?`<button type="button" class="pp-page ${n===this.page?'is-current':''}" data-page="${n}" aria-label="第${n}页" ${n===this.page?'aria-current="page"':''} ${empty?'disabled':''}>${n}</button>`:'<span class="pp-ellipsis" aria-hidden="true">…</span>').join('')}<button type="button" class="pp-arrow" data-next aria-label="下一页" ${this.page===this.pages||empty?'disabled':''}>›</button></div><div class="pp-jump"><label for="${this.id}">跳至</label><input id="${this.id}" class="pp-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="页码" aria-label="跳转页码" aria-describedby="${this.id}-error" ${empty?'disabled':''}><span>页</span><button type="button" data-jump ${empty?'disabled':''}>跳转</button></div></nav><p id="${this.id}-error" class="pp-error" role="status" aria-live="polite"></p>`;
  this.root.querySelector('.pp-size').onchange=e=>this.move(1,Number(e.target.value));
  this.root.querySelector('[data-prev]').onclick=()=>this.move(this.page-1);
  this.root.querySelector('[data-next]').onclick=()=>this.move(this.page+1);
  this.root.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>this.move(Number(b.dataset.page)));
  const input=this.root.querySelector('.pp-input');const jump=()=>{const value=input.value.trim();if(!/^\d+$/.test(value)||Number(value)<1||Number(value)>this.pages){input.setAttribute('aria-invalid','true');this.root.querySelector('.pp-error').textContent=`请输入 1–${this.pages} 的整数页码`;input.focus();return}this.move(Number(value))};
  this.root.querySelector('[data-jump]').onclick=jump;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();jump()}};input.oninput=()=>{input.removeAttribute('aria-invalid');this.root.querySelector('.pp-error').textContent=''};
 }
}
