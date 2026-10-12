"""Replay a serialized Atelier3D frame in Mesa OpenGL. NOT a browser screenshot."""
import ctypes as C,json,sys,re
from pathlib import Path
import numpy as np
from PIL import Image
I=C.c_int;U=C.c_uint;P=C.c_void_p;F=C.c_float;D=C.c_double
E=C.CDLL('libEGL.so.1');G=C.CDLL('libGL.so.1')
def bind(lib,n,r,args):
 f=getattr(lib,n); f.restype=r;f.argtypes=args;return f
bind(E,'eglGetProcAddress',P,[C.c_char_p])
f=C.CFUNCTYPE(P,U,P,C.POINTER(I))(E.eglGetProcAddress(b'eglGetPlatformDisplayEXT'));disp=f(0x31DD,None,None)
bind(E,'eglInitialize',U,[P,C.POINTER(I),C.POINTER(I)])(disp,C.byref(I()),C.byref(I()))
bind(E,'eglBindAPI',U,[U])(0x30A2)
cfg=P();n=I();bind(E,'eglChooseConfig',U,[P,C.POINTER(I),C.POINTER(P),I,C.POINTER(I)])(disp,(I*13)(0x3033,1,0x3040,8,0x3024,8,0x3023,8,0x3022,8,0x3025,24,0x3038),C.byref(cfg),1,C.byref(n))
bind(E,'eglCreatePbufferSurface',P,[P,P,C.POINTER(I)]);bind(E,'eglCreateContext',P,[P,P,P,C.POINTER(I)]);bind(E,'eglMakeCurrent',U,[P,P,P,P])
ctx=E.eglCreateContext(disp,cfg,None,(I*1)(0x3038));surf=None
specs={'glCreateShader':(U,[U]),'glShaderSource':(None,[U,I,C.POINTER(C.c_char_p),C.POINTER(I)]),'glCompileShader':(None,[U]),'glGetShaderiv':(None,[U,U,C.POINTER(I)]),'glGetShaderInfoLog':(None,[U,I,C.POINTER(I),C.c_char_p]),'glCreateProgram':(U,[]),'glAttachShader':(None,[U,U]),'glLinkProgram':(None,[U]),'glGetProgramiv':(None,[U,U,C.POINTER(I)]),'glGetProgramInfoLog':(None,[U,I,C.POINTER(I),C.c_char_p]),'glUseProgram':(None,[U]),'glGenBuffers':(None,[I,C.POINTER(U)]),'glBindBuffer':(None,[U,U]),'glBufferData':(None,[U,C.c_ssize_t,P,U]),'glGetAttribLocation':(I,[U,C.c_char_p]),'glEnableVertexAttribArray':(None,[U]),'glDisableVertexAttribArray':(None,[U]),'glVertexAttribPointer':(None,[U,I,U,U,I,P]),'glGetUniformLocation':(I,[U,C.c_char_p]),'glUniform1f':(None,[I,F]),'glUniform1i':(None,[I,I]),'glUniform2fv':(None,[I,I,P]),'glUniform3fv':(None,[I,I,P]),'glUniform4fv':(None,[I,I,P]),'glUniformMatrix3fv':(None,[I,I,U,P]),'glUniformMatrix4fv':(None,[I,I,U,P]),'glGenTextures':(None,[I,C.POINTER(U)]),'glBindTexture':(None,[U,U]),'glTexParameteri':(None,[U,U,I]),'glTexImage2D':(None,[U,I,I,I,I,I,U,U,P]),'glGenFramebuffers':(None,[I,C.POINTER(U)]),'glBindFramebuffer':(None,[U,U]),'glFramebufferTexture2D':(None,[U,U,U,U,I]),'glGenRenderbuffers':(None,[I,C.POINTER(U)]),'glBindRenderbuffer':(None,[U,U]),'glRenderbufferStorage':(None,[U,U,I,I]),'glFramebufferRenderbuffer':(None,[U,U,U,U]),'glCheckFramebufferStatus':(U,[U]),'glViewport':(None,[I,I,I,I]),'glClearColor':(None,[F,F,F,F]),'glClearDepth':(None,[D]),'glClear':(None,[U]),'glEnable':(None,[U]),'glDisable':(None,[U]),'glDepthMask':(None,[U]),'glDepthFunc':(None,[U]),'glCullFace':(None,[U]),'glFrontFace':(None,[U]),'glBlendFunc':(None,[U,U]),'glPolygonOffset':(None,[F,F]),'glColorMask':(None,[U,U,U,U]),'glLineWidth':(None,[F]),'glActiveTexture':(None,[U]),'glDrawElements':(None,[U,I,U,P]),'glDrawArrays':(None,[U,I,I]),'glReadPixels':(None,[I,I,I,I,U,U,P]),'glFinish':(None,[]),'glGetError':(U,[]),'glDeleteProgram':(None,[U]),'glDeleteShader':(None,[U]),'glDeleteBuffers':(None,[I,C.POINTER(U)]),'glDeleteTextures':(None,[I,C.POINTER(U)]),'glDeleteFramebuffers':(None,[I,C.POINTER(U)]),'glDeleteRenderbuffers':(None,[I,C.POINTER(U)])}
for name,(r,args) in specs.items(): bind(G,name,r,args)
ENUM={'triangles':4,'lines':1,'line_strip':3,'points':0,'front':0x404,'back':0x405,'ccw':0x901,'cw':0x900,'less':0x201,'lequal':0x203,'always':0x207,'src_alpha':0x302,'one_minus_src_alpha':0x303,'one':1,'zero':0,'nearest':0x2600,'linear':0x2601,'repeat':0x2901,'clamp':0x812f,'clamp_to_edge':0x812f}
def enum(x): return ENUM.get(x,x)
def new(name):
 v=U();getattr(G,name)(1,C.byref(v));return v.value
def ptr(arr):return arr.ctypes.data_as(P)
def shader(t,source):
 source='#version 120\n'+re.sub(r'precision\s+(?:highp|mediump|lowp)\s+\w+\s*;','',source)
 sh=G.glCreateShader(t);bs=source.encode();s=C.c_char_p(bs);G.glShaderSource(sh,1,C.byref(s),None);G.glCompileShader(sh);ok=I();G.glGetShaderiv(sh,0x8B81,C.byref(ok))
 if not ok.value:
  log=C.create_string_buffer(8192);G.glGetShaderInfoLog(sh,8192,None,log);raise RuntimeError(log.value.decode())
 return sh
def array(v,dtype):
 if isinstance(v,dict): v=list(v.values())
 return np.ascontiguousarray(v,dtype=dtype)
def render(packet,target):
 global surf
 W,H=packet['width'],packet['height'];surf=E.eglCreatePbufferSurface(disp,cfg,(I*5)(0x3057,W,0x3056,H,0x3038));assert E.eglMakeCurrent(disp,surf,surf,ctx)
 progs={};bufs=[];texs={};fbs=[];rbs=[];enabled=[]
 for k,p in packet['programs'].items():
  pr=G.glCreateProgram();v=shader(0x8B31,p['vertex']);f=shader(0x8B30,p['fragment']);G.glAttachShader(pr,v);G.glAttachShader(pr,f);G.glLinkProgram(pr);ok=I();G.glGetProgramiv(pr,0x8B82,C.byref(ok))
  if not ok.value:
   log=C.create_string_buffer(8192);G.glGetProgramInfoLog(pr,8192,None,log);raise RuntimeError(log.value.decode())
  G.glDeleteShader(v);G.glDeleteShader(f);progs[k]=pr
 geo={}
 for k,g in packet['geometries'].items():
  attrs={}
  for nm,a in g['attributes'].items():
   b=new('glGenBuffers');bufs.append(b);G.glBindBuffer(0x8892,b);ar=array(a['data'],np.float32);G.glBufferData(0x8892,ar.nbytes,ptr(ar),0x88e4);attrs[nm]=(b,a['size'],len(ar)//a['size'])
  ib=None;count=next(iter(attrs.values()))[2]
  if g.get('indices') is not None:
   ib=new('glGenBuffers');bufs.append(ib);G.glBindBuffer(0x8893,ib);ar=array(g['indices'],np.uint16);count=len(ar);G.glBufferData(0x8893,ar.nbytes,ptr(ar),0x88e4)
  geo[k]=(attrs,ib,count)
 for k,t in packet.get('textures',{}).items():
  tx=new('glGenTextures');G.glBindTexture(0xde1,tx)
  for p,v in [(0x2801,t.get('minFilter','nearest')),(0x2800,t.get('magFilter','nearest')),(0x2802,t.get('wrapS','clamp')),(0x2803,t.get('wrapT','clamp'))]:G.glTexParameteri(0xde1,p,enum(v))
  data=t.get('pixels',t.get('data'));ar=array(data,np.uint8) if data is not None else None
  w,h=t['width'],t['height'];G.glTexImage2D(0xde1,0,0x1908,w,h,0,0x1908,0x1401,ptr(ar)if ar is not None else None)
  fb=None
  if t.get('renderTarget'):
   fb=new('glGenFramebuffers');fbs.append(fb);G.glBindFramebuffer(0x8D40,fb);G.glFramebufferTexture2D(0x8D40,0x8CE0,0xde1,tx,0)
   rb=new('glGenRenderbuffers');rbs.append(rb);G.glBindRenderbuffer(0x8D41,rb);G.glRenderbufferStorage(0x8D41,0x81A6,w,h);G.glFramebufferRenderbuffer(0x8D40,0x8D00,0x8D41,rb)
   assert G.glCheckFramebufferStatus(0x8D40)==0x8CD5
  texs[k]=(tx,fb,w,h)
 def state(s):
  for cap,on in [(0xB71,s.get('depthTest',True)),(0xB44,bool(s.get('cullFace'))),(0xBE2,bool(s.get('blend'))),(0x8037,bool(s.get('polygonOffset')))]: (G.glEnable if on else G.glDisable)(cap)
  G.glDepthMask(int(s.get('depthWrite',True)));G.glDepthFunc(enum(s.get('depthFunc','lequal')))
  if s.get('cullFace'):G.glCullFace(enum(s['cullFace']))
  G.glFrontFace(enum(s.get('frontFace','ccw')))
  if s.get('blend'):
   bb=s['blend'];src,dst=('src_alpha','one_minus_src_alpha')if bb=='alpha' else ('src_alpha','one')if bb=='additive' else (bb.get('src','src_alpha'),bb.get('dst','one_minus_src_alpha'));G.glBlendFunc(enum(src),enum(dst))
  if s.get('polygonOffset'): G.glPolygonOffset(s['polygonOffset'].get('factor',0),s['polygonOffset'].get('units',0))
  G.glColorMask(*map(int,s.get('colorMask',[True]*4)));G.glLineWidth(s.get('lineWidth',1))
 def uniform(pr,nm,val):
  loc=G.glGetUniformLocation(pr,nm.encode())
  if loc<0:return
  typ=val['type'];v=val['value']
  if typ=='float':G.glUniform1f(loc,v)
  elif typ in ('int','sampler2D','bool'):G.glUniform1i(loc,int(v))
  else:
   a=array(v,np.float32)
   if typ.startswith('mat'):getattr(G,'glUniformMatrix'+typ[-1]+'fv')(loc,1,False,ptr(a))
   else:getattr(G,'glUniform'+typ[-1]+'fv')(loc,1,ptr(a))
 for p in packet['passes']:
  t=texs.get(p.get('target'));G.glBindFramebuffer(0x8D40,t[1]if t else 0);G.glViewport(*p.get('viewport',[0,0,t[2]if t else W,t[3]if t else H]));state(p);mask=0
  if p.get('clearColor') is not None:G.glClearColor(*p['clearColor']);mask|=0x4000
  if p.get('clearDepth') is not False:G.glClearDepth(p.get('clearDepth',1));mask|=0x100
  if mask:G.glClear(mask)
  for d in p.get('draws',[]):
   st={**p,**d};state(st);pr=progs[d['program']];G.glUseProgram(pr)
   for nm,v in {**p.get('uniforms',{}),**d.get('uniforms',{})}.items():uniform(pr,nm,v)
   for unit,(nm,k)in enumerate({**p.get('textures',{}),**d.get('textures',{})}.items()):G.glActiveTexture(0x84c0+unit);G.glBindTexture(0xde1,texs[k][0]);uniform(pr,nm,{'type':'int','value':unit})
   for loc in enabled:G.glDisableVertexAttribArray(loc)
   enabled=[];attrs,ib,count=geo[d['geometry']]
   for nm,(b,sz,n) in attrs.items():
    loc=G.glGetAttribLocation(pr,nm.encode())
    if loc<0:continue
    G.glBindBuffer(0x8892,b);G.glEnableVertexAttribArray(loc);G.glVertexAttribPointer(loc,sz,0x1406,False,0,None);enabled.append(loc)
   ct=d.get('count',count);first=d.get('first',0);mode=enum(d.get('mode','triangles'))
   if ib:G.glBindBuffer(0x8893,ib);G.glDrawElements(mode,ct,0x1403,P(first*2))
   else:G.glDrawArrays(mode,first,ct)
 G.glBindFramebuffer(0x8D40,0);G.glFinish();a=np.empty((H,W,4),np.uint8);G.glReadPixels(0,0,W,H,0x1908,0x1401,ptr(a));im=Image.fromarray(a[::-1]).convert('RGB');Path(target).parent.mkdir(parents=True,exist_ok=True);im.save(target)
 err=G.glGetError()
 for p in progs.values():G.glDeleteProgram(p)
 for ids,fun in [(bufs,G.glDeleteBuffers),([t[0]for t in texs.values()],G.glDeleteTextures),(fbs,G.glDeleteFramebuffers),(rbs,G.glDeleteRenderbuffers)]:
  if ids:fun(len(ids),(U*len(ids))(*ids))
 print('rendered',str(target),W,H,'GL error',err)
 return im
if __name__=='__main__':render(json.loads(Path(sys.argv[1]).read_text()),sys.argv[2])
