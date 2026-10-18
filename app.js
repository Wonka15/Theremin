(() => {
'use strict';
const $ = id => document.getElementById(id);
const field=$('playfield');
const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const scales={chromatic:[0,1,2,3,4,5,6,7,8,9,10,11],major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],pentatonic:[0,2,4,7,9],blues:[0,3,5,6,7,10],dorian:[0,2,3,5,7,9,10],whole:[0,2,4,6,8,10]};
let ctx=null, started=false, muted=false, pointerDown=false, motionEnabled=false, baseBeta=null, baseGamma=null;
let x=.5,y=.55, oscillators=[], mainGain=null, master=null, filter=null, drive=null, dry=null, wetGain=null, convolver=null, delay=null, delayGain=null, lfo=null, lfoGain=null, phaserLfo=null, allpass=null, phaserStages=[], phaserDepthGains=[], noiseSource=null, noiseGain=null, noiseFilter=null;
let cachedDistortionAmount=null,cachedDistortionCurve=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const num=id=>Number($(id).value);
function rootMidi(){return 48+num('root')}
function rawFrequency(){return 110*Math.pow(2,x*num('range'))*Math.pow(2,num('octave'))}
function quantizedFrequency(freq){
 if(!$('quantize').checked)return freq;
 const midi=69+12*Math.log2(freq/440), root=rootMidi(), allowed=scales[$('scale').value]||scales.chromatic;
 let best=Math.round(midi),distance=Infinity;
 for(let n=Math.floor(midi)-2;n<=Math.ceil(midi)+2;n++){
  if(((n-root)%12+12)%12===0||allowed.includes(((n-root)%12+12)%12)){
   const d=Math.abs(n-midi);if(d<distance){distance=d;best=n;}
  }
 }
 return 440*Math.pow(2,(best-69)/12);
}
function currentFreq(){return clamp(quantizedFrequency(rawFrequency()),35,8000)}
function noteName(freq){let midi=Math.round(69+12*Math.log2(freq/440));return names[(midi%12+12)%12]+(Math.floor(midi/12)-1)}
function updateLabels(){
 const mapping={glide:['glideOut',v=>v+' ms'],range:['rangeOut',v=>v+' octave'+(v==1?'':'s')],third:['thirdOut',v=>v+'%'],fifth:['fifthOut',v=>v+'%'],sub:['subOut',v=>v+'%'],harmonyMix:['harmonyMixOut',v=>v+'%'],motionDepth:['motionDepthOut',v=>(v/10).toFixed(1)+'×'],master:['masterOut',v=>v+'%'],detune:['detuneOut',v=>v+' cents'],filter:['filterOut',v=>v+' Hz'],resonance:['resonanceOut',v=>(v/10).toFixed(1)],vDepth:['vDepthOut',v=>v+' cents'],vSpeed:['vSpeedOut',v=>(v/10).toFixed(1)+' Hz'],pSpeed:['pSpeedOut',v=>(v/10).toFixed(1)+' Hz'],pDepth:['pDepthOut',v=>v+'%'],noiseMix:['noiseMixOut',v=>v+'%'],reverb:['reverbOut',v=>v+'%'],delay:['delayOut',v=>v+'%'],delayTime:['delayTimeOut',v=>v+' ms'],distortion:['distortionOut',v=>v+'%'],wet:['wetOut',v=>v+'%'],limiter:['limiterOut',v=>'−'+Math.abs(v)+' dB'],intensity:['intensityOut',v=>v+'%']};
 for(const [id,[out,format]] of Object.entries(mapping))$(out).textContent=format(num(id));
 $('scaleRead').textContent=$('scale').value==='chromatic'?'Chromatic':$('scale').selectedOptions[0].text;
}
function updateReadout(){
 const hz=currentFreq(),vol=Math.round((1-y)*100);
 $('freqRead').textContent=Math.round(hz);$('noteRead').textContent=noteName(hz);$('volRead').textContent=vol;
 field.style.setProperty('--px',(x*100)+'%');field.style.setProperty('--py',(y*100)+'%');
 if(started&&ctx){
  const now=ctx.currentTime, glide=Math.max(.003,num('glide')/1000);
  oscillators.forEach((o,i)=>{
   let f=hz;
   if(i===1)f=hz*Math.pow(2,4/12);if(i===2)f=hz*Math.pow(2,7/12);if(i===3)f=hz/2;
   if(o.frequency)o.frequency.setTargetAtTime(f,now,glide);
  });
  if(mainGain)mainGain.gain.setTargetAtTime(muted?0:(1-y)*.28,now,.035);
  if(master)master.gain.setTargetAtTime(muted?0:num('master')/100,now,.04);
 }
 updateLabels();
}
function makeImpulse(seconds=2.5,decay=2.5){
 const length=Math.floor(ctx.sampleRate*seconds),buffer=ctx.createBuffer(2,length,ctx.sampleRate);
 for(let c=0;c<2;c++){const d=buffer.getChannelData(c);for(let i=0;i<length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/length,decay)}
 return buffer;
}
function distortionCurve(amount){
 // Distortion is only rebuilt when its amount changes, not on every control update.
 if(cachedDistortionAmount===amount)return cachedDistortionCurve;
 const n=2048,curve=new Float32Array(n),k=amount*180;
 for(let i=0;i<n;i++){const v=i*2/(n-1)-1;curve[i]=amount===0?v:((3+k)*v*20*Math.PI/180)/(Math.PI+k*Math.abs(v))}
 cachedDistortionAmount=amount;cachedDistortionCurve=curve;return curve;
}
function buildAudio(){
 const AC=window.AudioContext||window.webkitAudioContext;
 if(!AC){$('statusText').textContent='This browser does not support Web Audio.';return false}
 ctx=new AC();
 const oscBus=ctx.createGain();mainGain=ctx.createGain();filter=ctx.createBiquadFilter();filter.type='lowpass';
 filter.frequency.value=num('filter');filter.Q.value=num('resonance')/10;
 drive=ctx.createWaveShaper();drive.curve=null;drive.oversample='2x';
 dry=ctx.createGain();convolver=ctx.createConvolver();wetGain=ctx.createGain();
 delay=ctx.createDelay(1.2);delay.delayTime.value=num('delayTime')/1000;delayGain=ctx.createGain();
 // A four-stage all-pass chain creates a more convincing phaser than a single stage.
 phaserStages=[350,750,1500,2800].map(frequency=>{const stage=ctx.createBiquadFilter();stage.type='allpass';stage.frequency.value=frequency;stage.Q.value=.7;return stage});
 allpass=phaserStages[0];
 master=ctx.createGain();const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=num('limiter');limiter.knee.value=6;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.18;
 oscBus.connect(mainGain);mainGain.connect(filter);filter.connect(drive);
 drive.connect(dry);dry.connect(master);
 drive.connect(convolver);convolver.connect(wetGain);wetGain.connect(master);
 drive.connect(delay);delay.connect(delayGain);delayGain.connect(master);
 let phaserInput=drive;for(const stage of phaserStages){phaserInput.connect(stage);phaserInput=stage}phaserInput.connect(master);
 master.connect(limiter);limiter.connect(ctx.destination);
 oscillators=[];
 for(let i=0;i<4;i++){
  const o=ctx.createOscillator(),g=ctx.createGain();o.type=$('wave').value;
  o.detune.value=i===0?num('detune'):0;g.gain.value=i===0?1:0;
  o.connect(g);g.connect(oscBus);o.start();oscillators.push(o);o._voiceGain=g;
 }
 lfo=ctx.createOscillator();lfo.type='sine';lfo.frequency.value=num('vSpeed')/10;lfoGain=ctx.createGain();lfoGain.gain.value=num('vDepth');lfo.connect(lfoGain);lfoGain.connect(oscillators[0].frequency);lfo.start();
 phaserLfo=ctx.createOscillator();phaserLfo.frequency.value=num('pSpeed')/10;
 phaserDepthGains=phaserStages.map((stage,i)=>{const gain=ctx.createGain();gain.gain.value=0;phaserLfo.connect(gain);gain.connect(stage.frequency);return gain});phaserLfo.start();
 // Noise is generated locally and never recorded or transmitted.
 const noiseBuffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),nd=noiseBuffer.getChannelData(0);
 for(let i=0;i<nd.length;i++)nd[i]=(Math.random()*2-1)*.5;
 noiseSource=ctx.createBufferSource();noiseSource.buffer=noiseBuffer;noiseSource.loop=true;noiseGain=ctx.createGain();noiseGain.gain.value=0;noiseFilter=ctx.createBiquadFilter();noiseFilter.type='lowpass';noiseFilter.frequency.value=1800;noiseSource.connect(noiseGain);noiseGain.connect(noiseFilter);noiseFilter.connect(drive);noiseSource.start();
 updateEffects();return true;
}
function updateEffects(){
 if(!ctx)return;
 const now=ctx.currentTime,fx=$('effectsOn').checked;
 filter.frequency.setTargetAtTime(num('filter'),now,.03);filter.Q.setTargetAtTime(num('resonance')/10,now,.03);
 const distortion=fx?num('distortion')/100*num('wet')/50:0;
 drive.curve=distortion===0?null:distortionCurve(distortion);
 const reverbAmount=fx?num('reverb')/100*num('wet')/50:0;
 // Avoid allocating a stereo impulse response until reverb is actually requested.
 if(reverbAmount>0&&!convolver.buffer)convolver.buffer=makeImpulse();
 wetGain.gain.setTargetAtTime(reverbAmount,now,.05);
 delay.delayTime.setTargetAtTime(num('delayTime')/1000,now,.03);delayGain.gain.setTargetAtTime(fx?num('delay')/100*num('wet')/50:0,now,.03);
 phaserDepthGains.forEach((gain,i)=>gain.gain.setTargetAtTime(fx?num('pDepth')*num('wet')/50*[3,6,10,15][i]:0,now,.03));phaserLfo.frequency.setTargetAtTime(num('pSpeed')/10,now,.03);
 lfo.frequency.setTargetAtTime(num('vSpeed')/10,now,.03);lfoGain.gain.setTargetAtTime(num('vDepth'),now,.03);
 noiseGain.gain.setTargetAtTime(num('noiseMix')/100*.08,now,.03);
 filter.type='lowpass';filter.frequency.setTargetAtTime(num('filter'),now,.03);
 noiseFilter.frequency.setTargetAtTime($('noiseColor').value==='pink'?Math.min(num('filter'),1800):num('filter'),now,.03);
 const h=num('harmonyMix')/100;
 oscillators.forEach((o,i)=>{if(o._voiceGain)o._voiceGain.gain.setTargetAtTime(i===0?1:(num(['third','fifth','sub'][i-1])/100)*h,now,.04)});
 if(master)master.gain.setTargetAtTime(muted?0:num('master')/100,now,.04);
}
async function startAudio(){
 if(!ctx&&!buildAudio())return;
 try{await ctx.resume()}catch(e){}
 started=ctx.state==='running';
 if(started){$('led').classList.add('live');$('liveLabel').textContent='AUDIO LIVE';$('startBtn').textContent='✓ Sound Running';$('muteBtn').disabled=false;$('fieldHint').textContent='Drag horizontally for pitch • vertically for volume';$('statusText').textContent='Sound is live. Begin gently and keep your listening volume comfortable.';updateReadout();updateEffects()}
 else $('statusText').textContent='Audio could not start. Tap Start Sound again.';
}
function pointer(e){const r=field.getBoundingClientRect();x=clamp((e.clientX-r.left)/r.width,0,1);y=clamp((e.clientY-r.top)/r.height,0,1);updateReadout()}
field.addEventListener('pointerdown',e=>{pointerDown=true;try{field.setPointerCapture(e.pointerId)}catch(_){}pointer(e)});
field.addEventListener('pointermove',e=>{if(pointerDown)pointer(e)});
function releasePointer(){pointerDown=false;if(!$('latch').checked){y=1;updateReadout()}}
field.addEventListener('pointerup',releasePointer);field.addEventListener('pointercancel',releasePointer);
$('startBtn').addEventListener('click',startAudio);
$('performanceBtn').addEventListener('click',()=>{const active=!document.body.classList.contains('performance-mode');document.body.classList.toggle('performance-mode',active);$('performanceBtn').setAttribute('aria-pressed',String(active));$('performanceBtn').textContent=active?'↙ Exit performance mode':'⛶ Performance mode';});
$('saveBtn').addEventListener('click',()=>{saveSettings();$('statusText').textContent='Setup saved on this device.';});
$('muteBtn').addEventListener('click',()=>{muted=!muted;$('muteBtn').textContent=muted?'▶ Unmute':'Ⅱ Mute';updateReadout();updateEffects()});
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));document.querySelectorAll('.panelset').forEach(p=>p.hidden=p.id!=='set-'+btn.dataset.tab)}));
$('motionBtn').addEventListener('click',async()=>{
 if(!('DeviceOrientationEvent'in window)){$('statusText').textContent='Motion sensors are not available here; touch mode still works.';return}
 try{if(typeof DeviceOrientationEvent.requestPermission==='function'){const p=await DeviceOrientationEvent.requestPermission();if(p!=='granted')throw Error('Motion permission was not granted.')}
 motionEnabled=true;baseBeta=null;baseGamma=null;window.addEventListener('deviceorientation',orientation);$('motionBtn').textContent='✓ Motion Enabled';$('modeLabel').textContent='Motion control active';$('statusText').textContent='Tilt gently to play. Touching the field still works.'}
 catch(e){$('statusText').textContent=e.message||'Could not enable motion. Check device permissions.'}
});
function orientation(e){if(!motionEnabled||e.beta==null||e.gamma==null)return;if(baseBeta===null){baseBeta=e.beta;baseGamma=e.gamma}
 const sensitivity=num('motionDepth')/10;x=clamp(.5+(e.gamma-baseGamma)/70*sensitivity,0,1);y=clamp(.55+(e.beta-baseBeta)/70*sensitivity,0,1);updateReadout()}
$('recenter').addEventListener('click',()=>{baseBeta=null;baseGamma=null;$('statusText').textContent='Motion reference reset. Hold the device in your preferred neutral position.'});
function bindRange(id,fn){$(id).addEventListener('input',()=>{updateReadout();if(fn)fn();saveSettings()})}
['glide','range','third','fifth','sub','harmonyMix','motionDepth','master','detune','filter','resonance','vDepth','vSpeed','pSpeed','pDepth','noiseMix','reverb','delay','delayTime','distortion','wet','limiter','intensity'].forEach(id=>bindRange(id,updateEffects));
['scale','root','quantize','octave'].forEach(id=>$(id).addEventListener('change',()=>{updateReadout();saveSettings()}));
$('wave').addEventListener('change',()=>{oscillators.forEach(o=>o.type=$('wave').value);saveSettings()});
$('noiseColor').addEventListener('change',()=>{updateEffects();saveSettings()});$('effectsOn').addEventListener('change',()=>{updateEffects();saveSettings()});
$('filter').addEventListener('input',()=>{if(filter)filter.frequency.setTargetAtTime(num('filter'),ctx.currentTime,.03)});
$('style').addEventListener('change',()=>{
 const s=$('style').value,root=document.documentElement;
 const themes={neon:['#73f5e8','#f18be8','#090c16'],aurora:['#a6ff91','#8d9cff','#09151b'],amber:['#ffc46b','#ff8d55','#17100a'],ice:['#8acbff','#c2eaff','#07121f'],mono:['#f0f4ff','#aab5c8','#101116']};
 const t=themes[s];root.style.setProperty('--accent',t[0]);root.style.setProperty('--accent2',t[1]);root.style.setProperty('--bg',t[2]);root.style.setProperty('--glow',t[0]+'2e');saveSettings();
});
$('grid').addEventListener('change',()=>{field.classList.toggle('grid',$('grid').checked);saveSettings()});
$('rings').addEventListener('change',()=>{document.querySelector('.aim').style.display=$('rings').checked?'block':'none';saveSettings()});
$('intensity').addEventListener('input',()=>{document.documentElement.style.setProperty('--visual-intensity',num('intensity')/100);saveSettings()});
function resetEffects(){[['reverb',15],['delay',0],['distortion',0],['wet',50],['delayTime',240],['pSpeed',3],['pDepth',0],['vDepth',0],['vSpeed',50],['noiseMix',0]].forEach(([id,v])=>$(id).value=v);$('effectsOn').checked=true;updateReadout();updateEffects()}
$('resetFx').addEventListener('click',resetEffects);
const presets={
 theremin:{wave:'sine',filter:5000,resonance:7,vDepth:0,vSpeed:50,reverb:12,delay:0,distortion:0,third:0,fifth:0,sub:0,noiseMix:0,scale:'chromatic',quantize:false},
 dream:{wave:'sine',filter:3500,resonance:8,vDepth:22,vSpeed:28,reverb:58,delay:22,distortion:0,third:24,fifth:12,sub:0,noiseMix:0,scale:'pentatonic',quantize:true},
 radio:{wave:'triangle',filter:1400,resonance:18,vDepth:3,vSpeed:35,reverb:8,delay:0,distortion:16,third:0,fifth:0,sub:0,noiseMix:8,scale:'chromatic',quantize:false},
 alien:{wave:'sawtooth',filter:2200,resonance:22,vDepth:55,vSpeed:85,reverb:32,delay:25,distortion:30,third:20,fifth:35,sub:12,noiseMix:4,scale:'whole',quantize:true},
 bell:{wave:'sine',filter:6500,resonance:4,vDepth:2,vSpeed:65,reverb:45,delay:18,distortion:0,third:35,fifth:25,sub:0,noiseMix:0,scale:'major',quantize:true}
};
function loadPreset(key){const p=presets[key];if(!p)return;for(const [id,v] of Object.entries(p)){if($(id)){if($(id).type==='checkbox')$(id).checked=v;else $(id).value=v}}updateReadout();updateEffects();saveSettings();$('statusText').textContent='Loaded preset: '+key+'.';}
$('loadPreset').addEventListener('click',()=>loadPreset($('preset').value));
$('randomBtn').addEventListener('click',()=>{
 const pick=(id,arr)=>$(id).value=arr[Math.floor(Math.random()*arr.length)];
 pick('wave',['sine','triangle','sawtooth','square']);pick('scale',['chromatic','major','minor','pentatonic','blues','dorian','whole']);pick('root',[0,2,4,5,7,9,11]);
 ['third','fifth','sub','vDepth','pDepth','noiseMix','delay','distortion'].forEach(id=>$(id).value=Math.floor(Math.random()*61));
 $('reverb').value=10+Math.floor(Math.random()*61);$('filter').value=700+Math.floor(Math.random()*7000);$('vSpeed').value=15+Math.floor(Math.random()*90);$('quantize').checked=Math.random()>.35;
 $('style').value=['neon','aurora','amber','ice','mono'][Math.floor(Math.random()*5)];$('style').dispatchEvent(new Event('change'));updateReadout();updateEffects();saveSettings();$('statusText').textContent='A new sound palette is ready.'});
const SETTINGS_KEY='theremim.settings.v1';
function saveSettings(){try{const settings={};document.querySelectorAll('.app input[id],.app select[id]').forEach(el=>{settings[el.id]=el.type==='checkbox'?el.checked:el.value});localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch(_){/* Storage may be unavailable in private browsing. */}}
function restoreSettings(){try{const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');for(const [id,value] of Object.entries(saved)){const el=$(id);if(!el||id==='preset')continue;if(el.type==='checkbox')el.checked=Boolean(value);else if(el.tagName==='SELECT'||el.type==='range')el.value=String(value)}$('style').dispatchEvent(new Event('change'));$('grid').dispatchEvent(new Event('change'));$('rings').dispatchEvent(new Event('change'));document.documentElement.style.setProperty('--visual-intensity',num('intensity')/100)}catch(_){/* Ignore malformed or unavailable local settings. */}}
document.querySelectorAll('.app input[id],.app select[id]').forEach(el=>el.addEventListener('change',saveSettings));
restoreSettings();updateReadout();
})();
