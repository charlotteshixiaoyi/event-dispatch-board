// In-memory DOM for exercising this dependency-free app without a browser.
const decode = s => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, x) => ({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[x]));
const encode = s => String(s).replace(/[&<>"]/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]));
const attrName = s => 'data-' + s.replace(/[A-Z]/g, x => '-' + x.toLowerCase());
class Classes {
 constructor(node) { this.node=node; }
 get all() { return new Set(this.node.className.split(/\s+/).filter(Boolean)); }
 add(...names) { const set=this.all; names.forEach(x=>set.add(x)); this.node.className=[...set].join(' '); }
 remove(...names) { const set=this.all; names.forEach(x=>set.delete(x)); this.node.className=[...set].join(' '); }
 contains(name) { return this.all.has(name); }
}
class Text {
 constructor(text) { this._text=decode(text); this.parentElement=null; }
 get textContent() { return this._text; }
 get outerHTML() { return encode(this._text); }
}
export class Element {
 constructor(tag, doc) {
  this.tagName=tag.toLowerCase(); this.ownerDocument=doc; this.attributes={}; this.children=[]; this.parentElement=null;
  this.listeners={}; this.style={}; this.classList=new Classes(this);
  this.dataset=new Proxy({}, {get:(_,key)=>this.getAttribute(attrName(key))??undefined,set:(_,key,value)=>{this.setAttribute(attrName(key),value);return true;}});
 }
 setAttribute(name,value) { this.attributes[name]=String(value); }
 getAttribute(name) { return this.attributes[name]??null; }
 get id(){return this.getAttribute('id')||'';} set id(v){this.setAttribute('id',v);}
 get className(){return this.getAttribute('class')||'';} set className(v){this.setAttribute('class',v);}
 get value(){ if(this._value!==undefined)return this._value; if(this.tagName==='select'){ const options=this.querySelectorAll('option');return (options.find(x=>x.getAttribute('selected')!==null)||options[0])?.value||''; } return this.getAttribute('value')||''; }
 set value(v){this._value=String(v);}
 get hidden(){return this.getAttribute('hidden')!==null;} set hidden(v){if(v)this.setAttribute('hidden','');else delete this.attributes.hidden;}
 get textContent(){return this.children.map(x=>x.textContent).join('');}
 set textContent(v){this.children=[new Text(String(v))];this.children[0].parentElement=this;}
 get innerHTML(){return this.children.map(x=>x.outerHTML).join('');}
 set innerHTML(v){this.children=[];this._value=undefined;parse(String(v),this,this.ownerDocument);}
 get outerHTML(){const tag=this.tagName==='radialgradient'?'radialGradient':this.tagName;return '<'+tag+Object.entries(this.attributes).map(([k,v])=>' '+k+'="'+encode(v)+'"').join('')+'>'+this.innerHTML+'</'+tag+'>';}
 append(...nodes){ for(const node of nodes){if(node.parentElement)node.remove?.();this.children.push(node);node.parentElement=this;} }
 appendChild(node){this.append(node);return node;}
 replaceChildren(...nodes){this.children.forEach(x=>x.parentElement=null);this.children=[];this.append(...nodes);}
 remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 fire(type,init={}){const event={type,target:this,currentTarget:this,detail:1,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...init};for(let el=this;el;el=el.parentElement){event.currentTarget=el;for(const fn of el.listeners?.[type]||[])fn(event);if(event.stopped)break;}return event;}
 click(){this.fire('click');}
 focus(){this.ownerDocument.activeElement=this;}
 blur(){}
 contains(other){for(let n=other;n;n=n.parentElement)if(n===this)return true;return false;}
 closest(selector){for(let n=this;n;n=n.parentElement)if(matches(n,selector))return n;return null;}
 querySelectorAll(selector){const out=[];const walk=node=>{for(const child of node.children||[])if(child instanceof Element){if(matches(child,selector))out.push(child);walk(child);}};walk(this);return out;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function simple(node,selector){
 if(!(node instanceof Element))return false;
 const attrs=[...selector.matchAll(/\[([\w-]+)(?:([*$^]?=)["']?([^\]"']*)["']?)?\]/g)];
 for(const [,key,op,value] of attrs){const actual=node.getAttribute(key);if(actual===null)return false;if(op==='='&&actual!==value)return false;if(op==='$='&&!actual.endsWith(value))return false;}
 const core=selector.replace(/\[[^\]]*\]/g,'');
 const tag=core.match(/^[\w-]+/);if(tag&&node.tagName!==tag[0].toLowerCase())return false;
 for(const [,id] of core.matchAll(/#([\w-]+)/g))if(node.id!==id)return false;
 for(const [,cls] of core.matchAll(/\.([\w-]+)/g))if(!node.classList.contains(cls))return false;
 return true;
}
function matches(node,selector){return selector.split(',').some(part=>{const bits=part.trim().split(/\s+/);if(!simple(node,bits.pop()))return false;let parent=node.parentElement;while(bits.length){const bit=bits.pop();while(parent&&!simple(parent,bit))parent=parent.parentElement;if(!parent)return false;parent=parent.parentElement;}return true;});}
const voids=new Set(['meta','link','input','img','br','hr','source']);
function parse(source,root,doc){const stack=[root];for(const token of source.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]+>|[^<]+/g)||[]){if(token.startsWith('<!'))continue;if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}if(token.startsWith('<')){const tag=token.match(/^<([\w:-]+)/)?.[1];if(!tag)continue;const el=new Element(tag,doc);for(const match of token.slice(tag.length+1,-1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))el.setAttribute(match[1],decode(match[2]??match[3]??match[4]??''));stack.at(-1).append(el);if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(el);}else stack.at(-1).append(new Text(token));}}
export function makeDocument(source){const doc=new Element('document',null);doc.ownerDocument=doc;doc.createElement=tag=>new Element(tag,doc);doc.getElementById=id=>doc.querySelector('#'+id);doc.elementFromPoint=()=>doc.hitTarget||null;parse(source,doc,doc);doc.body=doc.querySelector('body');doc.hidden=false;return doc;}
