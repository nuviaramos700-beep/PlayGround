import * as THREE from 'three';
import { CASES, VITALS, classify } from './data.js';
import './styles.css';

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const SAVE_KEY = 'vital-force-save';
const freshState = () => ({ active:0, completed:[], measured:{}, xp:120, coins:240, quizDone:[], sound:false, themes:[0], theme:0, player:{x:0,z:3} });
let state = freshState();
try {
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (saved && typeof saved === 'object') state = { ...freshState(), ...saved, player:{...freshState().player,...saved.player}, measured:saved.measured||{}, completed:saved.completed||[], quizDone:saved.quizDone||[], themes:saved.themes||[0] };
} catch { state = freshState(); }
const save = () => localStorage.setItem(SAVE_KEY, JSON.stringify(state));
let toastTimer;
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2300); }
function openModal({title,kicker='',description='',body='',actions='',wide=false,disclaimer=false}) {
  const root=$('#modalRoot');
  root.innerHTML=`<div class="modal-scrim"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true"><header class="modal-head"><div><div class="modal-kicker">${esc(kicker)}</div><h2>${esc(title)}</h2>${description?`<p>${esc(description)}</p>`:''}</div><button class="modal-close" aria-label="Cerrar">×</button></header><div class="modal-body">${body}${disclaimer?'<div class="disclaimer">Contenido de orientación educativa; no sustituye la formación, supervisión ni los protocolos profesionales.</div>':''}${actions?`<div class="modal-actions">${actions}</div>`:''}</div></section></div>`;
  root.querySelector('.modal-close').onclick=closeModal;
  root.querySelector('.modal-scrim').onclick=(event)=>{if(event.target===event.currentTarget)closeModal();};
}
function closeModal(){ $('#modalRoot').innerHTML=''; }
function activeCase(){ return CASES[state.active] || CASES[0]; }
function measuredKeys(){ return state.measured[activeCase().id] || []; }
function updateHUD(){
  const c=activeCase(); const done=measuredKeys(); const level=1+Math.floor(state.xp/500); const progress=state.xp%500;
  $('#caseCount').textContent=String(CASES.length-state.completed.length).padStart(2,'0');
  $('#caseId').textContent=c.id; $('#missionTitle').textContent=c.title; $('#missionDescription').textContent=c.description;
  $('#patientAvatar').textContent=c.initials; $('#patientName').innerHTML=`${esc(c.name)} <i>${c.age}</i>`;
  $('#patientReason').textContent=`${c.reason} · ${c.location}`; $('#nearbyName').textContent=c.name;
  $('#nearbyDetail').textContent=`Paciente · ${Math.max(1.2,distanceToPatient()).toFixed(1)} m`;
  $('#objectiveProgress').textContent=`${done.length} / ${VITALS.length}`;
  $('#objectiveList').innerHTML=VITALS.map(v=>`<div class="objective ${done.includes(v.key)?'done':''}"><i>${done.includes(v.key)?'✓':v.icon}</i><span>${esc(v.label)}</span></div>`).join('');
  $('#levelTop').textContent=String(level).padStart(2,'0'); $('#levelLabel').textContent=String(level).padStart(2,'0');
  $('#xpLabel').textContent=`${progress} / 500 XP`; $('#xpBar').style.width=`${progress/5}%`; $('#coinLabel').textContent=state.coins;
  document.documentElement.style.setProperty('--cyan',['#45d6e8','#68a9ff','#ff8593'][state.theme||0]);
  updateMap();
}
function updateMap(){const p=$('.map-player'); if(p){p.style.left=`${50+state.player.x*5}%`;p.style.top=`${49+state.player.z*3}%`;}}
let scene,camera,renderer,playerMesh,patientGroup;
const worldBounds={minX:-8,maxX:8,minZ:-6,maxZ:7};
function distanceToPatient(){const point=patientPosition();return Math.hypot(state.player.x-point.x,state.player.z-point.z);}
function patientPosition(){return [[4,-1],[-4,-2],[4,3],[-4,3]][state.active]||[4,-1] ? {x:([[4,-1],[-4,-2],[4,3],[-4,3]][state.active]||[4,-1])[0],z:([[4,-1],[-4,-2],[4,3],[-4,3]][state.active]||[4,-1])[1]}:{x:4,z:-1};}
function material(color,roughness=.82){return new THREE.MeshStandardMaterial({color,roughness});}
function box(parent,x,y,z,sx,sy,sz,color,opts={}){const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function buildBed(x,z){
  const group=new THREE.Group(); group.position.set(x,0,z); scene.add(group);
  box(group,0,.42,0,2.4,.15,1.1,'#d7e5e9'); box(group,0,.24,-.12,2.15,.22,.88,'#f1f5f4');
  box(group,-.82,.57,-.1,.52,.16,.68,'#e7f0ef');
  for(const dx of [-.9,.9])for(const dz of [-.37,.37])box(group,dx,.13,dz,.09,.28,.09,'#879fab');
  box(group,0,.79,-.56,2.45,.07,.07,'#8aa5b1'); box(group,0,.79,.56,2.45,.07,.07,'#8aa5b1');
  box(group,1.65,.45,-.35,.55,.72,.48,'#d6e4e6');
  const head=new THREE.Mesh(new THREE.SphereGeometry(.24,16,12),material('#dba98f'));head.position.set(.13,.96,0);head.castShadow=true;group.add(head);
  const body=box(group,-.28,.75,0,.75,.22,.48,['#7db8c6','#b18da9','#78a9c5','#cf9b80'][state.active],{});body.rotation.z=.02;
  return group;
}
function buildHospital(){
  const canvas=$('#world'); scene=new THREE.Scene();scene.background=new THREE.Color('#8ba7b6');scene.fog=new THREE.Fog('#8ba7b6',18,42);
  camera=new THREE.PerspectiveCamera(43,1,.1,100);camera.position.set(0,17,19);camera.lookAt(0,0,0);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene.add(new THREE.HemisphereLight('#e5f7ff','#536a72',2));const sun=new THREE.DirectionalLight('#fff4de',2.2);sun.position.set(-5,12,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
  const floor=box(scene,0,-.18,0,22,.35,18,'#d8e2de');floor.receiveShadow=true;
  const tile=material('#c5d5d3');for(let x=-10;x<=10;x+=2)for(let z=-8;z<=8;z+=2){const m=new THREE.Mesh(new THREE.BoxGeometry(1.96,.025,1.96),tile);m.position.set(x,-.003,z);m.receiveShadow=true;scene.add(m);}
  box(scene,0,2,-9,22,4,.3,'#e2ebea');box(scene,-11,2,0,.3,4,18,'#dce8e7');box(scene,11,2,0,.3,4,18,'#dce8e7');
  for(let x=-8;x<=8;x+=4){box(scene,x,3.8,-7.8,2.4,.08,.28,'#96d9df');box(scene,x,3.72,-7.8,1.9,.03,.18,'#edffff');}
  // Consultation bays, privacy screens, and clinical furniture.
  for(const [x,z] of [[-7,-3],[0,-3],[7,-3],[-7,4],[0,4],[7,4]]){box(scene,x,1.25,z,2.4,2.5,.09,'#c4d6d3');box(scene,x,2.52,z,2.4,.08,.14,'#96bdbd');}
  for(const [x,z] of [[-4,-2],[4,-1],[-4,3],[4,3]])buildBed(x,z);
  for(const [x,z] of [[-8,0],[0,0],[8,0]]){box(scene,x,.55,z,1.1,1.1,.6,'#eff5f1');box(scene,x,.15,z,.9,.16,.48,'#819aa3');}
  // Plants, monitors, wall panels, and signs add readable hospital detail.
  for(const [x,z] of [[-9,6],[9,6],[-9,-6],[9,-6]]){const pot=new THREE.Mesh(new THREE.CylinderGeometry(.35,.42,.55,10),material('#547b76'));pot.position.set(x,.22,z);scene.add(pot);const leaves=new THREE.Mesh(new THREE.SphereGeometry(.65,12,10),material('#4d8873'));leaves.position.set(x,.95,z);scene.add(leaves);}
  const sign=box(scene,0,2.65,-8.7,3.6,.65,.16,'#123b53');sign.castShadow=false;
  const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=96;const ctx=signCanvas.getContext('2d');ctx.fillStyle='#123b53';ctx.fillRect(0,0,512,96);ctx.fillStyle='#67e1ea';ctx.font='bold 34px sans-serif';ctx.fillText('✚  OBSERVACIÓN',24,60);const tex=new THREE.CanvasTexture(signCanvas);tex.colorSpace=THREE.SRGBColorSpace;sign.material=new THREE.MeshBasicMaterial({map:tex});
  patientGroup=buildBed(...Object.values(patientPosition()));
  const avatar=new THREE.Group();const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.28,.65,4,8),material('#287e91'));torso.position.y=.6;avatar.add(torso);const head=new THREE.Mesh(new THREE.SphereGeometry(.2,14,12),material('#dcae92'));head.position.y=1.15;avatar.add(head);avatar.position.set(state.player.x,0,state.player.z);scene.add(avatar);playerMesh=avatar;
  resizeScene();window.addEventListener('resize',resizeScene);renderer.setAnimationLoop(()=>{if(!scene)return;playerMesh.position.x=state.player.x;playerMesh.position.z=state.player.z;playerMesh.rotation.y=state.facing||0;renderer.render(scene,camera);});
}
function resizeScene(){if(!renderer||!camera)return;const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function movePlayer(dx,dz,speed=.34){
  const length=Math.hypot(dx,dz)||1;const nx=THREE.MathUtils.clamp(state.player.x+dx/length*speed,worldBounds.minX,worldBounds.maxX);const nz=THREE.MathUtils.clamp(state.player.z+dz/length*speed,worldBounds.minZ,worldBounds.maxZ);
  state.player.x=nx;state.player.z=nz;state.facing=Math.atan2(dx,dz);updateHUD();save();
}
function showCases(){
  const body=`<div class="case-grid">${CASES.map((c,i)=>`<button class="case-card ${i===state.active?'selected':''}" data-case="${i}"><small>${esc(c.id)} · ${esc(c.difficulty)} ${state.completed.includes(c.id)?' · ✓ COMPLETADO':''}</small><strong>${esc(c.title)}</strong><p>${esc(c.description)}</p><div class="case-meta"><span>${esc(c.name)} · ${c.age} años</span><span>${esc(c.location)}</span></div></button>`).join('')}</div><div class="disclaimer">Casos y pacientes completamente ficticios. El contenido es educativo, no diagnóstico ni guía de triaje.</div>`;
  openModal({title:'Casos disponibles',kicker:'SELECCIONA UN CASO',description:'Cada caso propone una práctica de registro e interpretación contextual.',body,wide:true});
  document.querySelectorAll('[data-case]').forEach(button=>button.onclick=()=>{state.active=Number(button.dataset.case);state.player={x:0,z:3};if(patientGroup)scene.remove(patientGroup);patientGroup=buildBed(...Object.values(patientPosition()));save();updateHUD();closeModal();toast(`Caso ${activeCase().id} seleccionado`);});
}
function showChart(){
  const c=activeCase();const done=measuredKeys();
  const body=`<div class="info-block"><small>IDENTIFICACIÓN · ${esc(c.id)} · ${esc(c.location.toUpperCase())}</small><p><strong>${esc(c.name)}, ${c.age} años</strong><br>${esc(c.reason)}<br><br><b>Antecedentes simulados</b><br>${esc(c.history)}<br><br><b>Observación inicial</b><br>${esc(c.observation)}</p></div><div class="chart-vitals">${VITALS.map(v=>{const recorded=done.includes(v.key);const result=recorded?v.value(c):'Pendiente';return `<div class="chart-row"><span>${v.icon} ${esc(v.label)}</span><strong>${esc(result)}${recorded?` ${esc(v.unit)}`:''}</strong><button data-measure="${v.key}">${recorded?'REVISAR':'MEDIR'}</button></div>`;}).join('')}</div>${done.length===VITALS.length?`<div class="procedure-note">${esc(c.note)}</div>`:''}`;
  openModal({title:'Expediente del paciente',kicker:'REGISTRO SIMULADO · CONFIDENCIALIDAD FICTICIA',description:`${done.length} de ${VITALS.length} mediciones registradas en este caso.`,body,wide:true,disclaimer:true});
  document.querySelectorAll('[data-measure]').forEach(button=>button.onclick=()=>showProcedure(button.dataset.measure));
}
function showProcedure(key,step=0){
  const v=VITALS.find(item=>item.key===key);if(!v)return;const c=activeCase();const done=measuredKeys().includes(v.key);const current=Math.min(step,v.steps.length-1);
  const result=done?`<div class="procedure-result"><div><small>LECTURA SIMULADA · ${esc(v.unit)}</small><br><strong>${esc(v.value(c))}</strong></div><span class="status-pill"><i></i>REGISTRADA</span></div>`:'';
  const steps=`<ol class="step-list">${v.steps.map((text,i)=>`<li class="${i<step||done?'done':i===current?'current':''}"><i>${i<step||done?'✓':String(i+1).padStart(2,'0')}</i>${esc(text)}</li>`).join('')}</ol>`;
  const actions=done?'<button class="btn" data-return>VOLVER AL EXPEDIENTE</button>':`<button class="btn primary" data-next>${step===v.steps.length-1?'REGISTRAR MEDICIÓN':'CONTINUAR'} <span>→</span></button>`;
  openModal({title:v.label,kicker:`PROCEDIMIENTO SIMULADO · ${esc(v.tool.toUpperCase())}`,description:`${esc(c.name)} · paso ${done?v.steps.length:current+1} de ${v.steps.length}`,body:`<div class="procedure"><div class="procedure-top"><small>${esc(v.short)}</small><span>${done?'COMPLETADO':`PASO ${current+1} / ${v.steps.length}`}</span></div><h3>${esc(v.actions[done?v.actions.length-1:current])}</h3><p>${esc(v.steps[done?v.steps.length-1:current])}</p>${steps}${result}</div>${done?`<div class="procedure-note">${esc(classify(c,v.key)[2])}</div>`:''}`,actions,disclaimer:true});
  if(done)$('#modalRoot [data-return]').onclick=showChart;
  else $('#modalRoot [data-next]').onclick=()=>{if(current<v.steps.length-1){showProcedure(key,current+1);return;}recordMeasurement(key);};
}
function recordMeasurement(key){
  const c=activeCase();const list=state.measured[c.id]||(state.measured[c.id]=[]);
  if(!list.includes(key)){list.push(key);state.xp+=20;toast(`${VITALS.find(v=>v.key===key).label} registrada · +20 XP`);}
  save();updateHUD();
  if(list.length===VITALS.length&&!state.completed.includes(c.id)){state.completed.push(c.id);state.xp+=c.xp;state.coins+=c.coins;save();updateHUD();openModal({title:'Caso completado',kicker:`${c.id} · VALORACIÓN FINALIZADA`,description:`Has registrado los seis signos vitales de ${c.name}.`,body:`<div class="procedure-result"><div><small>RECOMPENSA DE PRÁCTICA</small><br><strong>+${c.xp} XP · +${c.coins} ✦</strong></div><span class="status-pill"><i></i>COMPLETADO</span></div><p class="procedure-note">${esc(c.note)} Los resultados de la simulación no son diagnósticos.</p>`,actions:'<button class="btn primary" data-finish>CONTINUAR</button>',disclaimer:true});$('#modalRoot [data-finish]').onclick=showChart;return;}
  showProcedure(key);
}
function showInteraction(){
  const c=activeCase();const close=distanceToPatient()<5.5;
  const body=`<div class="info-block"><small>${close?'PACIENTE A TU ALCANCE':'PACIENTE A DISTANCIA'}</small><p>${close?`Estás junto a ${esc(c.name)}. Elige una actividad educativa.`:`${esc(c.name)} se encuentra a ${distanceToPatient().toFixed(1)} m. Explora con WASD o las flechas y acércate para comenzar.`}</p></div><div class="vital-grid">${VITALS.map(v=>`<button class="case-card" data-start-procedure="${v.key}"><small>${v.icon} ${esc(v.short)}</small><strong>${esc(v.label)}</strong><p>${measuredKeys().includes(v.key)?'✓ Registrada · abrir resultado':'Iniciar procedimiento simulado'}</p></button>`).join('')}</div>`;
  openModal({title:close?'Valoración del paciente':'Acércate al paciente',kicker:'INTERACCIÓN EDUCATIVA',body,wide:true});
  document.querySelectorAll('[data-start-procedure]').forEach(button=>button.onclick=()=>{if(!close){toast('Acércate a la cama para iniciar la valoración');return;}showProcedure(button.dataset.startProcedure,measuredKeys().includes(button.dataset.startProcedure)?VITALS.find(v=>v.key===button.dataset.startProcedure).steps.length:0);});
}
function showAcademy(){
  const body=`<div class="academy-list">${lessons.map((l,i)=>`<article class="lesson"><div class="lesson-icon">${l.icon}</div><div><strong>${l.title}</strong><p>${l.text}</p></div><button data-lesson="${i}">${state.quizDone.includes(i)?'REPASAR':'LECCIÓN'} ↗</button></article>`).join('')}</div><div class="disclaimer">La academia presenta orientación general para aprendizaje. No representa protocolos clínicos oficiales.</div>`;
  openModal({title:'Academia clínica',kicker:'APRENDE A TU RITMO',description:'Microlecciones breves y preguntas de repaso. Completar un repaso correcto suma experiencia.',body,wide:true});document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>showQuiz(Number(b.dataset.lesson)));
}
const lessons=[{icon:'◉',title:'Presión arterial',text:'Técnica, posición del brazo y límites de una lectura aislada.',key:'bp'},{icon:'♥',title:'Pulso y frecuencia cardíaca',text:'Sitios de palpación, conteo, ritmo y amplitud.',key:'hr'},{icon:'⌁',title:'Respiración y SpO₂',text:'Observación discreta, calidad de señal y comunicación de cambios.',key:'spo2'},{icon:'♨',title:'Temperatura',text:'Método, sitio y registro contextual de la medición.',key:'temp'}];
const quizQuestions=[
 {q:'¿Qué ayuda a mejorar una medición de presión arterial simulada?',options:['Brazo apoyado a la altura del corazón','Brazalete sobre ropa gruesa','Brazo sin apoyo y en movimiento'],correct:0,why:'La posición y el ajuste adecuados ayudan a obtener una medición más fiable; sigue siempre las instrucciones del equipo.'},
 {q:'En esta práctica, ¿cómo se cuenta el pulso radial?',options:['Con el pulgar durante 10 segundos','Con índice y medio; durante 60 segundos en esta práctica','Solo observando el color de la piel'],correct:1,why:'El pulgar tiene pulso propio. La actividad propone índice y medio y un conteo completo de 60 segundos.'},
 {q:'¿Qué es importante al observar la respiración?',options:['Indicar al paciente que respire más rápido','Observar discretamente un ciclo de subida y bajada','Contar solo cuando la persona habla'],correct:1,why:'La observación discreta evita alterar el patrón; registra también ritmo y esfuerzo.'},
 {q:'Una lectura aislada de SpO₂ debe interpretarse…',options:['Como diagnóstico definitivo','Con calidad de señal, contexto y comunicación al responsable','Sin revisar el sensor'],correct:1,why:'Comprueba la señal y el contexto; una lectura aislada no establece un diagnóstico.'}
];
function showQuiz(index){
  const q=quizQuestions[index%quizQuestions.length];let chosen=-1;let answered=false;
  const draw=()=>{const options=q.options.map((o,i)=>`<button class="quiz-option ${chosen===i?(i===q.correct?'correct':'wrong'):answered&&i===q.correct?'correct':''}" data-answer="${i}" ${answered?'disabled':''}>${String.fromCharCode(65+i)}. ${o}</button>`).join('');const feedback=answered?`<div class="quiz-feedback">${chosen===q.correct?'¡Correcto! ':'Revisa esta idea. '}${q.why}</div>`:'';openModal({title:'Repaso rápido',kicker:`ACADEMIA · ${lessons[index].title.toUpperCase()}`,description:q.q,body:`${options}${feedback}`,actions:answered?'<button class="btn primary" data-quiz-close>VOLVER A LA ACADEMIA</button>':''});document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{if(answered)return;answered=true;chosen=Number(b.dataset.answer);if(chosen===q.correct&&!state.quizDone.includes(index)){state.quizDone.push(index);state.xp+=25;save();updateHUD();}draw();});if(answered)$('#modalRoot [data-quiz-close]').onclick=showAcademy;};draw();
}
function showInventory(){const body=`<div class="academy-list">${VITALS.map(v=>`<article class="lesson"><div class="lesson-icon">${v.icon}</div><div><strong>${esc(v.tool)}</strong><p>Equipo de práctica para ${esc(v.label.toLowerCase())}. Se utiliza en procedimientos simulados.</p></div><span class="status-pill"><i></i>DISPONIBLE</span></article>`).join('')}</div>`;openModal({title:'Equipo de valoración',kicker:'INVENTARIO DEL TURNO',description:'Herramientas disponibles en esta simulación.',body});}
function showStats(){const completed=state.completed.length;const measures=Object.values(state.measured).reduce((n,a)=>n+a.length,0);const body=`<div class="stat-grid"><div class="stat-box"><strong>${completed}/${CASES.length}</strong><span>CASOS COMPLETADOS</span></div><div class="stat-box"><strong>${measures}</strong><span>MEDICIONES REGISTRADAS</span></div><div class="stat-box"><strong>${state.xp}</strong><span>EXPERIENCIA TOTAL</span></div></div><div class="info-block" style="margin-top:12px"><small>PROGRESO DE FORMACIÓN</small><p>Nivel ${1+Math.floor(state.xp/500)} · ${state.xp%500} de 500 XP para el siguiente nivel. Los datos se guardan automáticamente en este dispositivo.</p></div>`;openModal({title:'Estadísticas',kicker:'TU PROGRESO',body});}
function showAchievements(){const items=[['✚','Primeros pasos','Completa tu primer caso.',state.completed.length>=1],['◉','Observador/a','Registra seis mediciones.',Object.values(state.measured).some(a=>a.length>=6)],['⌘','Estudiante','Responde correctamente una pregunta de academia.',state.quizDone.length>0],['★','Turno completo','Completa todos los casos disponibles.',state.completed.length===CASES.length]];const body=`<div class="academy-list">${items.map(a=>`<article class="lesson"><div class="lesson-icon">${a[0]}</div><div><strong>${a[1]}</strong><p>${a[2]}</p></div><span class="status-pill"><i style="background:${a[3]?'var(--green)':'#667b8b'}"></i>${a[3]?'DESBLOQUEADO':'PENDIENTE'}</span></article>`).join('')}</div>`;openModal({title:'Logros',kicker:'HITOS DE FORMACIÓN',body});}
function showShop(){const themes=[['Turquesa','#45d6e8'],['Azul clínico','#68a9ff'],['Coral suave','#ff8593']];const body=`<div class="shop-grid">${themes.map(([name,color],i)=>`<div class="shop-item"><div class="shop-swatch" style="background:linear-gradient(135deg,${color},#173d58)">✚</div><strong>${name}</strong><small>${(state.themes||[0]).includes(i)?i===state.theme?'Equipado':'Desbloqueado':'Personalización visual'}</small><button data-theme="${i}">${(state.themes||[0]).includes(i)?i===state.theme?'EQUIPADO':'EQUIPAR':`${i===1?100:150} ✦`}</button></div>`).join('')}</div><p style="font-size:9px;color:#91a9b8;line-height:1.5">Las personalizaciones cambian el color de acento de la interfaz. Se pueden adquirir con fichas obtenidas en casos.</p>`;openModal({title:'Personalizar',kicker:`${state.coins} FICHAS DISPONIBLES`,body});document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.theme),cost=i===1?100:150;if(!(state.themes||[0]).includes(i)){if(state.coins<cost){toast('No tienes suficientes fichas');return;}state.coins-=cost;state.themes.push(i);}state.theme=i;save();updateHUD();showShop();toast(`${themes[i][0]} equipado`);});}
function showSettings(){const body=`<div class="info-block"><small>SONIDO</small><p>El juego usa sonidos de interfaz opcionales. No contiene audio clínico ni alarmas.</p><button class="btn" id="soundToggle">${state.sound?'🔊 Sonido activado':'🔇 Sonido desactivado'}</button></div><div class="info-block" style="margin-top:10px"><small>DATOS GUARDADOS</small><p>El progreso se almacena localmente en este navegador.</p><button class="btn alert" id="resetSave">Reiniciar progreso</button></div>`;openModal({title:'Configuración',kicker:'PREFERENCIAS',body,disclaimer:true});$('#soundToggle').onclick=()=>{state.sound=!state.sound;save();showSettings();};$('#resetSave').onclick=()=>{if(confirm('¿Borrar todo el progreso guardado en este dispositivo?')){localStorage.removeItem(SAVE_KEY);location.reload();}};}
function showAbout(){openModal({title:'Acerca del juego',kicker:'SIMULADOR CLÍNICO · EDICIÓN EDUCATIVA',body:'<div class="info-block"><small>PROPÓSITO</small><p>VITAL FORCE: EMERGENCIAS es una experiencia educativa ficticia para practicar la secuencia de toma y registro de signos vitales en un entorno 3D.</p></div><div class="info-block" style="margin-top:9px"><small>IMPORTANTE</small><p>No es un dispositivo médico, no realiza triaje ni ofrece diagnóstico o tratamiento. No sustituye formación acreditada, supervisión profesional ni protocolos locales. Ante una emergencia real, contacta con los servicios de emergencia de tu zona.</p></div>',disclaimer:true});}
function showCredits(){openModal({title:'Créditos',kicker:'VITAL FORCE: EMERGENCIAS',body:'<div class="info-block"><small>CREACIÓN</small><p>Videojuego creado por <strong>Brandon Ramos CHLO</strong>.</p></div><div class="info-block" style="margin-top:9px"><small>TECNOLOGÍA Y CONTENIDO</small><p>Three.js · Vite · escenario 3D procedural. Casos ficticios y contenido orientativo redactado para esta experiencia educativa.</p></div>',disclaimer:true});}
function showMap(){const body=`<div class="map-art" style="height:260px"><span class="map-room r1">RECEPCIÓN</span><span class="map-room r2">CONSULTA</span><span class="map-room r3">OBSERVACIÓN</span><span class="map-room r4">URGENCIAS</span><span class="map-corridor"></span><i class="map-player" style="left:${50+state.player.x*2}%;top:${50+state.player.z*2}%">▲</i><i class="map-patient">●</i></div><p style="font-size:9px;color:#9eb5c5">Usa WASD o las flechas para explorar; acércate a una cama y pulsa E para valorar.</p>`;openModal({title:'Plano de planta',kicker:'ORIENTACIÓN',body});}
function showMission(){showCases();}
function interact(){if(distanceToPatient()>5.5){toast('Acércate a la cama para iniciar la valoración');return;}showInteraction();}
function doAction(action){
  switch(action){
    case 'home': $('#intro').classList.remove('hidden');break;
    case 'mission':showMission();break;
    case 'chart':showChart();break;
    case 'academy':showAcademy();break;
    case 'inventory':showInventory();break;
    case 'achievements':showAchievements();break;
    case 'shop':showShop();break;
    case 'stats':showStats();break;
    case 'map':showMap();break;
    case 'interact':interact();break;
    case 'settings':showSettings();break;
    case 'about':showAbout();break;
    case 'credits':showCredits();break;
    case 'sound':state.sound=!state.sound;save();toast(state.sound?'Sonido de interfaz activado':'Sonido de interfaz desactivado');break;
  }
}
const directions={forward:[0,-1],back:[0,1],left:[-1,0],right:[1,0]};
function installControls(){
  document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>doAction(button.dataset.action)));
  document.querySelectorAll('[data-move]').forEach(button=>{
    const move=()=>{const [x,z]=directions[button.dataset.move];movePlayer(x,z);};
    button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);move();button._hold=setInterval(move,120);});
    const release=()=>{clearInterval(button._hold);button._hold=null;};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  });
  const held=new Set();window.addEventListener('keydown',event=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','e','E'].includes(event.key))event.preventDefault();
    if(event.key==='Escape'){closeModal();return;}
    if(event.key.toLowerCase()==='e'&&!event.repeat){interact();return;}
    if(event.repeat)return;
    const key=event.key.toLowerCase();if(key==='shift'||['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key))held.add(key);
  });window.addEventListener('keyup',event=>held.delete(event.key.toLowerCase()));window.addEventListener('blur',()=>held.clear());
  let last=0;function tick(now){if(now-last>115&&held.size){last=now;let x=0,z=0;if(held.has('w')||held.has('arrowup'))z--;if(held.has('s')||held.has('arrowdown'))z++;if(held.has('a')||held.has('arrowleft'))x--;if(held.has('d')||held.has('arrowright'))x++;movePlayer(x,z,held.has('shift')?.62:.34);}requestAnimationFrame(tick);}requestAnimationFrame(tick);
  $('#startGame').addEventListener('click',()=>$('#intro').classList.add('hidden'));
  window.addEventListener('keydown',event=>{if(event.key==='Enter'&&!$('#intro').classList.contains('hidden'))$('#intro').classList.add('hidden');});
}
function updateClock(){const now=new Date();$('#clock').textContent=now.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',hour12:false});}
function start(){
  buildHospital();installControls();updateHUD();updateClock();window.setInterval(updateClock,30000);
  document.title='VITAL FORCE: EMERGENCIAS';
}
start();
