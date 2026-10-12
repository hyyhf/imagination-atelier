/* Atelier3D — dependency-free WebGL1 scene renderer and portable frame exporter.
 * Column-major matrices. Right-handed world, +Y up. Angles are radians except
 * camera.fov (degrees). No DOM is accessed until Renderer or Orbit is created.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Atelier3D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var TAU = Math.PI * 2, geometrySerial = 0;
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var vec3 = {
    add: function (a,b) { return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]; },
    sub: function (a,b) { return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; },
    scale: function (a,s) { return [a[0]*s,a[1]*s,a[2]*s]; },
    dot: function (a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; },
    cross: function (a,b) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; },
    length: function (a) { return Math.hypot(a[0],a[1],a[2]); },
    normalize: function (a) { var n=Math.hypot(a[0],a[1],a[2]); return n>1e-12 ? [a[0]/n,a[1]/n,a[2]/n] : [0,1,0]; }
  };
  function identity() { return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]; }
  function multiply(a,b) {
    var o=new Array(16);
    for(var c=0;c<4;c++) for(var r=0;r<4;r++) {
      var s=0; for(var k=0;k<4;k++) s+=a[k*4+r]*b[c*4+k]; o[c*4+r]=s;
    }
    return o;
  }
  function translation(x,y,z) { var o=identity(); o[12]=x;o[13]=y;o[14]=z;return o; }
  function scaling(x,y,z) { if(y===undefined)y=x;if(z===undefined)z=x;return [x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1]; }
  function rotationX(a) { var c=Math.cos(a),s=Math.sin(a);return [1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]; }
  function rotationY(a) { var c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]; }
  function rotationZ(a) { var c=Math.cos(a),s=Math.sin(a);return [c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]; }
  function compose(options) {
    options=options||{};
    var p=options.position||[0,0,0],r=options.rotation||[0,0,0],s=options.scale===undefined?[1,1,1]:options.scale;
    if(typeof s==='number')s=[s,s,s];
    return multiply(translation(p[0],p[1],p[2]),multiply(rotationZ(r[2]),multiply(rotationY(r[1]),multiply(rotationX(r[0]),scaling(s[0],s[1],s[2])))));
  }
  function lookAt(eye,target,up) {
    up=up||[0,1,0]; var z=vec3.normalize(vec3.sub(eye,target)),x=vec3.cross(up,z);
    if(vec3.length(x)<1e-6)x=vec3.cross(Math.abs(z[2])<0.9?[0,0,1]:[1,0,0],z);
    x=vec3.normalize(x); var y=vec3.cross(z,x);
    return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-vec3.dot(x,eye),-vec3.dot(y,eye),-vec3.dot(z,eye),1];
  }
  function perspective(fov,aspect,near,far) {
    var f=1/Math.tan(fov*Math.PI/360),nf=1/(near-far);
    return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0];
  }
  function orthographic(left,right,bottom,top,near,far) {
    return [2/(right-left),0,0,0,0,2/(top-bottom),0,0,0,0,-2/(far-near),0,-(right+left)/(right-left),-(top+bottom)/(top-bottom),-(far+near)/(far-near),1];
  }
  function normalMatrix(m) {
    var a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]];
    var x=vec3.cross(b,c),y=vec3.cross(c,a),z=vec3.cross(a,b),d=vec3.dot(a,x);
    if(Math.abs(d)<1e-12) return [1,0,0,0,1,0,0,0,1];
    return x.concat(y,z).map(function(v){return v/d;});
  }
  function transformPoint(m,p) {
    var w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];
    return [(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w,(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w,(m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14])/w];
  }
  function cameraMatrices(camera,aspect) {
    camera=camera||{}; var eye=camera.position||camera.eye||[6,4,7],target=camera.target||[0,0,0];
    var near=camera.near===undefined?0.05:camera.near,far=camera.far===undefined?150:camera.far;
    if(!(near>0&&far>near))throw new Error('Camera requires 0 < near < far.');
    var view=lookAt(eye,target,camera.up),projection;
    if(camera.ortho) { var h=typeof camera.ortho==='number'?camera.ortho:10;projection=orthographic(-h*aspect/2,h*aspect/2,-h/2,h/2,near,far); }
    else projection=perspective(camera.fov===undefined?42:camera.fov,aspect,near,far);
    return {view:view,projection:projection,viewProjection:multiply(projection,view),eye:eye,target:target};
  }
  function project(point,camera,width,height) {
    var m=cameraMatrices(camera,width/height).viewProjection,p=transformPoint(m,point);
    var w=m[3]*point[0]+m[7]*point[1]+m[11]*point[2]+m[15];
    return {x:(p[0]*.5+.5)*width,y:(.5-p[1]*.5)*height,z:p[2],visible:w>0&&p[2]>=-1&&p[2]<=1&&Math.abs(p[0])<=1&&Math.abs(p[1])<=1};
  }
  function flatNumbers(values) {
    if(!values)return [];
    var result=[];for(var i=0;i<values.length;i++) {
      if(Array.isArray(values[i])||ArrayBuffer.isView(values[i])) for(var j=0;j<values[i].length;j++)result.push(Number(values[i][j]));
      else result.push(Number(values[i]));
    }return result;
  }
  function triangles(positions,indices,normals) {
    var p=flatNumbers(positions),idx=indices===undefined||indices===null?null:flatNumbers(indices),n=normals?flatNumbers(normals):null;
    if(!p.length||p.length%3)throw new Error('Geometry positions must contain xyz vertices.');
    if(p.some(function(v){return !Number.isFinite(v);}))throw new Error('Geometry positions contain non-finite numbers.');
    var count=p.length/3;if(count>65535)throw new Error('Split geometry into meshes with at most 65535 vertices.');
    if(!idx){idx=[];for(var i=0;i<count;i++)idx.push(i);}
    if(idx.length%3)throw new Error('Triangle indices must be a multiple of three.');
    if(idx.some(function(v){return !Number.isInteger(v)||v<0||v>=count;}))throw new Error('Geometry index is outside its vertex array.');
    if(!n) {
      n=new Array(p.length).fill(0);
      for(var k=0;k<idx.length;k+=3) {
        var a=idx[k]*3,b=idx[k+1]*3,c=idx[k+2]*3;
        var ab=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],ac=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]],face=vec3.cross(ab,ac);
        for(var q=0;q<3;q++)for(var e=0;e<3;e++)n[idx[k+q]*3+e]+=face[e];
      }
      for(var t=0;t<n.length;t+=3){var nn=vec3.normalize(n.slice(t,t+3));n[t]=nn[0];n[t+1]=nn[1];n[t+2]=nn[2];}
    }
    if(n.length!==p.length||n.some(function(v){return !Number.isFinite(v);}))throw new Error('Geometry normals must match positions and be finite.');
    return {id:'a3d_g'+(++geometrySerial),version:0,attributes:{aPosition:{size:3,data:p},aNormal:{size:3,data:n}},indices:idx,indexType:'uint16'};
  }
  function box(w,h,d) {
    w=w===undefined?1:w;h=h===undefined?1:h;d=d===undefined?1:d;
    var p=[],n=[],idx=[];
    var faces=[
      [[w/2,0,0],[0,0,-d],[0,h,0],[1,0,0]],
      [[-w/2,0,0],[0,0,d],[0,h,0],[-1,0,0]],
      [[0,h/2,0],[w,0,0],[0,0,-d],[0,1,0]],
      [[0,-h/2,0],[w,0,0],[0,0,d],[0,-1,0]],
      [[0,0,d/2],[w,0,0],[0,h,0],[0,0,1]],
      [[0,0,-d/2],[-w,0,0],[0,h,0],[0,0,-1]]
    ];
    faces.forEach(function(f){var off=p.length/3;[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].forEach(function(t){for(var q=0;q<3;q++)p.push(f[0][q]+f[1][q]*t[0]+f[2][q]*t[1]);n.push.apply(n,f[3]);});idx.push(off,off+1,off+2,off,off+2,off+3);});
    return triangles(p,idx,n);
  }
  function roundBox(width,height,depth,radius) {
    width=width===undefined?1:width;height=height===undefined?1:height;depth=depth===undefined?1:depth;
    var half=[width/2,height/2,depth/2],radius=Math.min(radius===undefined?.006:radius,Math.min(width,height,depth)*.2),steps=4,positions=[],normals=[],indices=[];
    // Project subdivided faces onto a rounded cuboid: every axis bound is retained.
    var axes=[[0,1,2,1],[0,2,1,-1],[1,2,0,1],[1,0,2,-1],[2,0,1,1],[2,1,0,-1]];
    axes.forEach(function(f){var offset=positions.length/3,axis=f[0],u=f[1],v=f[2],sign=f[3];
      for(var j=0;j<=steps;j++)for(var i=0;i<=steps;i++){
        var point=[0,0,0];point[axis]=half[axis]*sign;
        var knots=[-1,-1+2*radius/(2*half[u]),0,1-2*radius/(2*half[u]),1];point[u]=knots[i]*half[u];
        knots=[-1,-1+radius/half[v],0,1-radius/half[v],1];point[v]=knots[j]*half[v];
        var inner=point.map(function(x,k){return clamp(x,-half[k]+radius,half[k]-radius)}),normal=vec3.normalize(vec3.sub(point,inner));
        positions.push.apply(positions,vec3.add(inner,vec3.scale(normal,radius)));normals.push.apply(normals,normal);
      }
      for(var y=0;y<steps;y++)for(var x=0;x<steps;x++){var a=offset+y*(steps+1)+x,c=a+steps+1;indices.push(a,a+1,c,a+1,c+1,c);}
    });return triangles(positions,indices,normals);
  }
  function plane(w,d,nx,nz,heightFunction) {
    w=w===undefined?1:w;d=d===undefined?1:d;nx=Math.max(1,Math.floor(nx||1));nz=Math.max(1,Math.floor(nz||1));
    var p=[],idx=[],normals=heightFunction?null:[];
    for(var z=0;z<=nz;z++)for(var x=0;x<=nx;x++) {
      var px=(x/nx-.5)*w,pz=(z/nz-.5)*d;p.push(px,heightFunction?heightFunction(px,pz,x,z):0,pz);if(normals)normals.push(0,1,0);
    }
    for(var j=0;j<nz;j++)for(var i=0;i<nx;i++){var a=j*(nx+1)+i,b=a+1,c=a+nx+1,e=c+1;idx.push(a,c,b,b,c,e);}
    return triangles(p,idx,normals);
  }
  function sphere(radius,segments,rings) {
    radius=radius===undefined?1:radius;segments=Math.max(3,Math.floor(Math.max(segments||40,32)));rings=Math.max(2,Math.floor(rings||24));
    var p=[],n=[],idx=[];
    for(var j=0;j<=rings;j++){var phi=j/rings*Math.PI;
      for(var i=0;i<=segments;i++){var theta=i/segments*TAU,x=Math.sin(phi)*Math.cos(theta),y=Math.cos(phi),z=Math.sin(phi)*Math.sin(theta);p.push(radius*x,radius*y,radius*z);n.push(x,y,z);}
    }
    for(var y=0;y<rings;y++)for(var x=0;x<segments;x++){var a=y*(segments+1)+x,b=a+segments+1;if(y>0)idx.push(a,a+1,b);if(y<rings-1)idx.push(a+1,b+1,b);}
    return triangles(p,idx,n);
  }
  function cylinder(radiusTop,radiusBottom,height,segments,capped) {
    radiusTop=radiusTop===undefined?.5:radiusTop;radiusBottom=radiusBottom===undefined?radiusTop:radiusBottom;height=height===undefined?1:height;
    segments=Math.max(3,Math.floor(Math.max(segments||40,32)));capped=capped!==false;
    var p=[],n=[],idx=[],slope=(radiusBottom-radiusTop)/Math.max(1e-9,height);
    for(var y=0;y<2;y++)for(var i=0;i<=segments;i++){var a=i/segments*TAU,r=y?radiusTop:radiusBottom,nn=vec3.normalize([Math.cos(a),slope,Math.sin(a)]);p.push(r*Math.cos(a),(y-.5)*height,r*Math.sin(a));n.push.apply(n,nn);}
    for(var s=0;s<segments;s++){var b=s+segments+1;idx.push(s,b,s+1,s+1,b,b+1);}
    if(capped)for(var end=0;end<2;end++) {
      var rr=end?radiusTop:radiusBottom;if(rr<=0)continue;var center=p.length/3,yy=(end-.5)*height;p.push(0,yy,0);n.push(0,end?1:-1,0);
      for(var t=0;t<=segments;t++){var aa=t/segments*TAU;p.push(rr*Math.cos(aa),yy,rr*Math.sin(aa));n.push(0,end?1:-1,0);}
      for(var j=0;j<segments;j++){if(end)idx.push(center,center+j+2,center+j+1);else idx.push(center,center+j+1,center+j+2);}
    }
    return triangles(p,idx,n);
  }
  function torus(majorRadius,minorRadius,radialSegments,tubularSegments,arc) {
    majorRadius=majorRadius===undefined?1:majorRadius;minorRadius=minorRadius===undefined?.22:minorRadius;
    radialSegments=Math.max(3,Math.floor(radialSegments||16));tubularSegments=Math.max(3,Math.floor(tubularSegments||64));arc=arc===undefined?TAU:arc;
    var p=[],n=[],idx=[];
    for(var i=0;i<=tubularSegments;i++){var u=i/tubularSegments*arc;
      for(var j=0;j<=radialSegments;j++){var v=j/radialSegments*TAU,cv=Math.cos(v),sv=Math.sin(v),cu=Math.cos(u),su=Math.sin(u);p.push((majorRadius+minorRadius*cv)*cu,minorRadius*sv,(majorRadius+minorRadius*cv)*su);n.push(cv*cu,sv,cv*su);}
    }
    for(var y=0;y<tubularSegments;y++)for(var x=0;x<radialSegments;x++){var a=y*(radialSegments+1)+x,b=a+radialSegments+1;idx.push(a,a+1,b,a+1,b+1,b);}
    return triangles(p,idx,n);
  }
  function lathe(profile,segments) {
    if(!profile||profile.length<2)throw new Error('Lathe needs at least two [radius,y] profile points.');
    segments=Math.max(3,Math.floor(Math.max(segments||48,72)));var p=[],n=[],idx=[];
    for(var j=0;j<profile.length;j++) {
      var prev=profile[Math.max(0,j-1)],next=profile[Math.min(profile.length-1,j+1)],dr=next[0]-prev[0],dy=next[1]-prev[1];
      for(var i=0;i<=segments;i++){var a=i/segments*TAU,nn=vec3.normalize([dy*Math.cos(a),-dr,dy*Math.sin(a)]);p.push(profile[j][0]*Math.cos(a),profile[j][1],profile[j][0]*Math.sin(a));n.push.apply(n,nn);}
    }
    for(var y=0;y<profile.length-1;y++)for(var x=0;x<segments;x++){var aa=y*(segments+1)+x,b=aa+segments+1;idx.push(aa,b,aa+1,aa+1,b,b+1);}
    return triangles(p,idx,n);
  }
  function tube(points,radius,sides,options) {
    radius=radius===undefined?.05:radius;sides=Math.max(3,Math.floor(sides||10));options=options||{};
    if(!points||points.length<2)throw new Error('Tube needs at least two xyz points.');
    var p=[],n=[],idx=[],lastNormal=null,tangents=[],frames=[];
    for(var i=0;i<points.length;i++) {
      var tangent=vec3.normalize(vec3.sub(points[Math.min(points.length-1,i+1)],points[Math.max(0,i-1)]));
      var normal=lastNormal?vec3.sub(lastNormal,vec3.scale(tangent,vec3.dot(lastNormal,tangent))):vec3.cross(tangent,Math.abs(tangent[1])<.9?[0,1,0]:[1,0,0]);
      if(vec3.length(normal)<1e-6)normal=vec3.cross(tangent,Math.abs(tangent[1])<.9?[0,1,0]:[1,0,0]);
      normal=vec3.normalize(normal);var binormal=vec3.normalize(vec3.cross(tangent,normal));lastNormal=normal;tangents.push(tangent);frames.push([normal,binormal]);
    }
    if(options.closed&&vec3.length(vec3.sub(points[0],points[points.length-1]))<1e-6) {
      var end=frames[frames.length-1][0],start=frames[0][0],t0=tangents[0];
      var twist=Math.atan2(vec3.dot(vec3.cross(end,start),t0),vec3.dot(end,start));
      for(var f=0;f<frames.length;f++){var angle=twist*f/(frames.length-1),nn=frames[f][0],bb=frames[f][1];frames[f]=[vec3.add(vec3.scale(nn,Math.cos(angle)),vec3.scale(bb,Math.sin(angle))),vec3.add(vec3.scale(bb,Math.cos(angle)),vec3.scale(nn,-Math.sin(angle)))];}
      frames[frames.length-1]=frames[0];
    }
    for(var a=0;a<points.length;a++)for(var s=0;s<=sides;s++){
      var ang=s/sides*TAU,direction=vec3.add(vec3.scale(frames[a][0],Math.cos(ang)),vec3.scale(frames[a][1],Math.sin(ang)));
      var r=typeof radius==='function'?radius(a/(points.length-1),a):radius;p.push.apply(p,vec3.add(points[a],vec3.scale(direction,r)));n.push.apply(n,direction);
    }
    for(var y=0;y<points.length-1;y++)for(var x=0;x<sides;x++){var v=y*(sides+1)+x,w=v+sides+1;idx.push(v,v+1,w,v+1,w+1,w);}
    if(options.caps!==false&&!options.closed)for(var e=0;e<2;e++){
      var row=e?points.length-1:0,normal=vec3.scale(tangents[row],e?1:-1),center=p.length/3;p.push.apply(p,points[row]);n.push.apply(n,normal);
      for(var t=0;t<=sides;t++){var off=(row*(sides+1)+t)*3;p.push(p[off],p[off+1],p[off+2]);n.push.apply(n,normal);}
      for(var q=0;q<sides;q++){if(e)idx.push(center,center+q+1,center+q+2);else idx.push(center,center+q+2,center+q+1);}
    }
    return triangles(p,idx,n);
  }
  function touch(geometry) { geometry.version=(geometry.version||0)+1;return geometry; }
  function cachedPrimitive(fn,limit) {var cache=new Map();return function(){var args=Array.prototype.slice.call(arguments),key=JSON.stringify(args);if(cache.has(key))return cache.get(key);var g=fn.apply(null,args);cache.set(key,g);if(cache.size>limit)cache.delete(cache.keys().next().value);return g;};}
  var plainBox=box;box=cachedPrimitive(function(w,h,d){var g=plainBox(w,h,d);g.boxSize=[w===undefined?1:w,h===undefined?1:h,d===undefined?1:d];return g;},256); roundBox=cachedPrimitive(roundBox,384); sphere=cachedPrimitive(sphere,96); cylinder=cachedPrimitive(cylinder,160); torus=cachedPrimitive(torus,96); lathe=cachedPrimitive(lathe,128);
  function color(value,fallback) {
    if(value===undefined||value===null)value=fallback===undefined?[.8,.8,.8]:fallback;
    if(typeof value==='string') {
      var s=value.replace('#','');if(s.length===3)s=s.split('').map(function(x){return x+x;}).join('');
      if(!/^[0-9a-fA-F]{6}$/.test(s))throw new Error('Colors must be #RGB, #RRGGBB or [r,g,b] in sRGB.');
      return [parseInt(s.slice(0,2),16)/255,parseInt(s.slice(2,4),16)/255,parseInt(s.slice(4,6),16)/255];
    }return [Number(value[0]),Number(value[1]),Number(value[2])];
  }
  function linearColor(value,fallback) { return color(value,fallback).map(function(x){return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);}); }
  var mainVertex = `
precision highp float;
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uModel;
uniform mat3 uNormalMatrix;
uniform mat4 uViewProjection;
uniform mat4 uLightViewProjection;
varying vec3 vWorld;
varying vec3 vLocal;
varying vec3 vSurface;
varying vec3 vNormal;
varying vec4 vShadow;
void main() {
  vec4 world=uModel*vec4(aPosition,1.0);
  vWorld=world.xyz;vLocal=aPosition;vSurface=aPosition*vec3(length(uModel[0].xyz),length(uModel[1].xyz),length(uModel[2].xyz));vNormal=uNormalMatrix*aNormal;
  vShadow=uLightViewProjection*world;
  gl_Position=uViewProjection*world;
}
`;
  var mainFragment = `
precision highp float;
varying vec3 vWorld;
varying vec3 vLocal;
varying vec3 vSurface;
varying vec3 vNormal;
varying vec4 vShadow;
uniform mat3 uNormalMatrix;
uniform vec3 uColor;
uniform vec3 uEmission;
uniform vec3 uEye;
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform vec3 uEnvSky;
uniform vec3 uEnvGround;
uniform vec3 uFogColor;
uniform vec4 uClipPlane;
uniform vec2 uShadowTexel;
uniform sampler2D uShadowMap;
uniform float uRoughness;
uniform float uMetalness;
uniform float uOpacity;
uniform float uTexture;
uniform float uTextureScale;
uniform float uTextureStrength;
uniform float uUnlit;
uniform float uLightIntensity;
uniform float uEnvIntensity;
uniform float uStudio;
uniform float uExposure;
uniform float uFogDensity;
uniform float uFogHeight;
uniform float uTime;
uniform float uShadowEnabled;
uniform float uReceiveShadow;
uniform float uShadowBias;
uniform float uShadowSoftness;
uniform float uShadowStrength;
uniform float uAO;
uniform float uClipEnabled;
const float PI=3.141592653589793;
float hash3(vec3 p) { p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z); }
float noise3(vec3 p) {
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p) { return .5714*noise3(p)+.2857*noise3(p*2.07)+.1429*noise3(p*4.17); }
float unpackDepth(vec4 c) { return dot(c,(255.0/256.0)*vec4(1.0/16777216.0,1.0/65536.0,1.0/256.0,1.0)); }
uniform sampler2D uCameraDepth;
uniform mat4 uCameraVP;
uniform mat4 uInverseVP;
uniform float uContactEnabled;
uniform float uContactRadius;
uniform float uContactStrength;
vec3 restoreWorld(vec2 uv,float depth){vec4 q=uInverseVP*vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);return q.xyz/q.w;}
float contactShade(vec3 normal){
 if(uContactEnabled<.5||uUnlit>.5)return 1.0;
 vec3 tangent=normalize(cross(normal,abs(normal.y)<.9?vec3(0,1,0):vec3(1,0,0))),bitangent=cross(normal,tangent);
 float occluded=0.0;
 for(int i=0;i<12;i++){
  float fi=float(i),angle=fi*2.39996323,z=.15+.78*(fi+.5)/12.0,rad=sqrt(1.0-z*z);
  vec3 direction=tangent*cos(angle)*rad+bitangent*sin(angle)*rad+normal*z;
  vec3 samplePos=vWorld+direction*uContactRadius;vec4 clip=uCameraVP*vec4(samplePos,1.0);vec3 screen=clip.xyz/clip.w*.5+.5;
  if(clip.w>0.0&&screen.x>.001&&screen.x<.999&&screen.y>.001&&screen.y<.999){
   float depth=unpackDepth(texture2D(uCameraDepth,screen.xy));vec3 actual=restoreWorld(screen.xy,depth);
   float range=length(actual-vWorld),blocked=step(depth+.00003,screen.z);
   occluded+=blocked*(1.0-smoothstep(uContactRadius,uContactRadius*2.4,range))*step(.007*uContactRadius,range);
  }
 }
 return clamp(1.0-occluded/12.0*uContactStrength,.22,1.0);
}

float shadowVisibility(vec3 n,vec3 l) {
  if(uShadowEnabled<.5||uReceiveShadow<.5)return 1.0;
  vec3 p=vShadow.xyz/vShadow.w*.5+.5;
  if(p.x<=0.0||p.x>=1.0||p.y<=0.0||p.y>=1.0||p.z<=0.0||p.z>=1.0)return 1.0;
  float slope=1.0-max(dot(n,l),0.0);
  float bias=uShadowBias*(1.0+3.0*slope);
  float sum=0.0;
  for(int y=0;y<4;y++)for(int x=0;x<4;x++){
    vec2 offset=(vec2(float(x),float(y))-1.5)*uShadowTexel*uShadowSoftness;
    sum+=step(p.z-bias,unpackDepth(texture2D(uShadowMap,p.xy+offset)));
  }
  return mix(1.0,sum/16.0,uShadowStrength);
}
vec3 fresnel(float cosine,vec3 f0) { return f0+(1.0-f0)*pow(1.0-cosine,5.0); }
float distribution(float nh,float roughness) {
  float a=roughness*roughness,a2=a*a,d=nh*nh*(a2-1.0)+1.0;
  return a2/max(PI*d*d,.000001);
}
float visibilityTerm(float nd,float roughness) {
  float k=(roughness+1.0);k=k*k*.125;return nd/(nd*(1.0-k)+k);
}
float softbox(vec3 direction,vec3 center,vec2 size,float roughness) {
  vec3 side=normalize(cross(vec3(0,1,0),center)),up=cross(center,side);
  float facing=dot(direction,center);
  vec2 q=vec2(dot(direction,side),dot(direction,up))/max(facing,.001);
  float blur=.018+roughness*roughness*1.8;
  vec2 box=1.0-smoothstep(size+vec2(blur*.1),size+vec2(blur),abs(q));
  return box.x*box.y*step(.0,facing);
}
vec3 environment(vec3 direction,float roughness) {
  vec3 env=mix(uEnvGround,uEnvSky,smoothstep(-.7,.85,direction.y))*.55;
  float broad=softbox(direction,normalize(vec3(-.55,.70,.45)),vec2(.36,.72),roughness);
  float strip=softbox(direction,normalize(vec3(.72,.30,-.45)),vec2(.13,.65),roughness);
  float overhead=pow(max(dot(direction,normalize(vec3(.15,1.0,.05))),0.0),mix(120.0,4.0,roughness));
  env+=uStudio*(vec3(1.0,.90,.76)*broad+vec3(.68,.82,1.0)*strip*.9+vec3(1.0)*overhead*.6)*mix(2.4,.8,roughness);
  return env*uEnvIntensity;
}
vec3 filmic(vec3 c) { return clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.0,1.0); }
vec3 toSRGB(vec3 c) {
  return mix(c*12.92,1.055*pow(max(c,vec3(0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),c));
}
void main() {
  if(uClipEnabled>.5&&dot(vec4(vWorld,1.0),uClipPlane)<0.0)discard;
  vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
  vec3 geometricNormal=n,p=vLocal*uTextureScale,base=uColor;
  float rough=clamp(uRoughness,.055,1.0),metal=clamp(uMetalness,0.0,1.0);
  if(uTexture>.5&&uTexture<1.5) {
    p=vSurface*uTextureScale;
    float warp=fbm(vec3(p.x*3.0,p.y*.35,p.z*.35));
    float ring=.5+.5*sin(p.x*175.0+sin(p.z*2.0)*.8+warp*8.0);
    float fine=noise3(vec3(p.x*230.0,p.y*1.2,p.z*1.2));
    base*=mix(1.0,.82+.14*ring+.05*fine,uTextureStrength);
    rough=clamp(rough+(ring-.5)*.09*uTextureStrength,.08,1.0);
  } else if(uTexture>1.5&&uTexture<2.5) {
    float grain=noise3(p*95.0),speck=step(.82,grain);
    base*=mix(1.0,.97+.055*grain-.09*speck,uTextureStrength);
    rough=clamp(rough+(grain-.5)*.075*uTextureStrength,.07,1.0);
  } else if(uTexture>2.5&&uTexture<3.5) {
    float rock=fbm(p*3.8),vein=smoothstep(.44,.48,rock)-smoothstep(.49,.53,rock);
    base*=mix(1.0,.58+.67*rock+.14*vein,uTextureStrength);
    float e=.035,v=noise3(p*9.0);
    vec3 grad=vec3(noise3(p*9.0+vec3(e,0,0))-v,noise3(p*9.0+vec3(0,e,0))-v,noise3(p*9.0+vec3(0,0,e))-v)/e;
    vec3 worldGradient=uNormalMatrix*grad;
    n=normalize(n-uTextureStrength*.09*(worldGradient-n*dot(worldGradient,n)));
    rough=max(rough,.72);
  } else if(uTexture>3.5&&uTexture<4.5) {
    float a=p.x*3.1+p.z*1.6+uTime*.75,b=p.z*4.0-p.x*1.2-uTime*.52;
    vec3 wave=vec3(.095*cos(a)+.028*cos(b*2.1),0.0,.07*sin(b)+.03*sin(a*1.7));
    wave=uNormalMatrix*wave;
    n=normalize(n+uTextureStrength*(wave-n*dot(wave,n)));
    base*=.94+.06*sin(a+b);
  }
  vec3 v=normalize(uEye-vWorld),l=normalize(uLightDirection),h=normalize(v+l);
  float nl=max(dot(n,l),0.0),nv=max(dot(n,v),.0001),nh=max(dot(n,h),0.0),vh=max(dot(v,h),0.0);
  vec3 f0=mix(vec3(.04),base,metal),f=fresnel(vh,f0);
  float d=distribution(nh,rough),g=visibilityTerm(nv,rough)*visibilityTerm(nl,rough);
  vec3 spec=d*g*f/max(4.0*nv*nl,.0001),kd=(1.0-f)*(1.0-metal);
  float shadow=shadowVisibility(geometricNormal,l);
  vec3 direct=(kd*base/PI+spec)*uLightColor*uLightIntensity*nl*shadow;
  vec3 hemi=mix(uEnvGround,uEnvSky,smoothstep(-.75,.85,n.y))*uEnvIntensity;
  vec3 grazing=f0+(max(vec3(1.0-rough),f0)-f0)*pow(1.0-nv,5.0);
  vec3 ambient=(1.0-grazing)*(1.0-metal)*base*hemi+environment(reflect(-v,n),rough)*grazing*mix(1.0,.62,rough);
  vec3 lit=direct+ambient*uAO*contactShade(geometricNormal)+uEmission;
  vec3 mapped=uUnlit>.5?base+uEmission:filmic(lit*uExposure);
  float distanceToEye=length(uEye-vWorld);
  float density=uFogDensity*exp(-max(vWorld.y,0.0)*uFogHeight);
  float fog=1.0-exp(-density*distanceToEye);
  mapped=mix(mapped,uFogColor,clamp(fog,0.0,1.0));
  gl_FragColor=vec4(toSRGB(mapped),uOpacity);
}
`;
  var shadowVertex = `
precision highp float;
attribute vec3 aPosition;
uniform mat4 uModel;
uniform mat4 uLightViewProjection;
varying vec3 vWorld;
void main(){vec4 world=uModel*vec4(aPosition,1.0);vWorld=world.xyz;gl_Position=uLightViewProjection*world;}
`;
  var shadowFragment = `
precision highp float;
varying vec3 vWorld;
uniform vec4 uClipPlane;
uniform float uClipEnabled;
vec4 packDepth(float depth) {
  vec4 encoded=fract(depth*vec4(16777216.0,65536.0,256.0,1.0));
  return (encoded-encoded.xxyz*vec4(0.0,1.0/256.0,1.0/256.0,1.0/256.0))*(256.0/255.0);
}
void main(){if(uClipEnabled>.5&&dot(vec4(vWorld,1.0),uClipPlane)<0.0)discard;gl_FragColor=packDepth(gl_FragCoord.z);}
`;
  var backgroundVertex = `
precision highp float;
attribute vec3 aPosition;
void main(){gl_Position=vec4(aPosition,1.0);}
`;
  var backgroundFragment = `
precision highp float;
uniform vec2 uResolution;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform float uVignette;
void main(){
  vec2 uv=gl_FragCoord.xy/uResolution;
  vec3 color=mix(uBottom,uTop,smoothstep(0.0,1.0,uv.y));
  float edge=dot((uv-.5)*vec2(1.15,1.0),(uv-.5)*vec2(1.15,1.0));
  gl_FragColor=vec4(color*(1.0-uVignette*edge),1.0);
}
`;
  var programs={
    main:{vertex:mainVertex,fragment:mainFragment},
    shadow:{vertex:shadowVertex,fragment:shadowFragment},
    background:{vertex:backgroundVertex,fragment:backgroundFragment}
  };
  var backgroundGeometry={id:'a3d_background',version:0,attributes:{aPosition:{size:3,data:[-1,-1,0,3,-1,0,-1,3,0]}},indices:[0,1,2],indexType:'uint16'};
  var textureTypes={none:0,wood:1,ceramic:2,rock:3,water:4};
  function uniform(type,value){return {type:type,value:ArrayBuffer.isView(value)?Array.from(value):value};}
  function resolve(value,time){return typeof value==='function'?value(time):value;}
  function Scene(options) {
    Object.assign(this,{camera:{position:[6,4,7],target:[0,0,0],fov:42},background:'#ece9e2',light:{direction:[-3,7,5]},objects:[]},options||{});
  }
  function frame(scene,width,height,time) {
    time=time===undefined?0:time;scene=resolve(scene,time)||{};
    width=Math.max(1,Math.floor(width));height=Math.max(1,Math.floor(height));
    var camera=cameraMatrices(scene.camera,width/height),light=scene.light||{},environmentSpec=scene.environment||{},fog=scene.fog||{};
    var direction=vec3.normalize(light.direction||[-3,7,5]),target=light.target||[0,0,0],extent=light.shadowExtent===undefined?8:light.shadowExtent;
    var lightDistance=light.shadowDistance===undefined?Math.max(12,extent*3):light.shadowDistance,near=light.shadowNear===undefined?.1:light.shadowNear,far=light.shadowFar===undefined?lightDistance+extent*3:light.shadowFar;
    var lightEye=vec3.add(target,vec3.scale(direction,lightDistance));
    var lightVP=multiply(orthographic(-extent,extent,-extent,extent,near,far),lookAt(lightEye,target,[0,1,0]));
    var shadows=light.shadows!==false,shadowSize=shadows?Math.max(64,Math.min(4096,Math.floor(light.shadowSize||1024))):1;
    var background=scene.background===undefined?'#ece9e2':scene.background,bgObject=typeof background==='object'&&!Array.isArray(background)&&!ArrayBuffer.isView(background);
    var top=color(bgObject?background.top:background,'#ece9e2'),bottom=color(bgObject?background.bottom:background,top);
    var sceneUniforms={
      uViewProjection:uniform('mat4',camera.viewProjection),uLightViewProjection:uniform('mat4',lightVP),uEye:uniform('vec3',camera.eye),
      uLightDirection:uniform('vec3',direction),uLightColor:uniform('vec3',linearColor(light.color,'#fff4e4')),uLightIntensity:uniform('float',light.intensity===undefined?3.2:light.intensity),
      uEnvSky:uniform('vec3',linearColor(environmentSpec.sky,'#b8c4d5')),uEnvGround:uniform('vec3',linearColor(environmentSpec.ground,'#615951')),
      uEnvIntensity:uniform('float',environmentSpec.intensity===undefined?.75:environmentSpec.intensity),uStudio:uniform('float',environmentSpec.studio===false?0:1),
      uExposure:uniform('float',scene.exposure===undefined?1.05:scene.exposure),uTime:uniform('float',time),
      uFogColor:uniform('vec3',linearColor(fog.color,bottom)),uFogDensity:uniform('float',fog.density||0),uFogHeight:uniform('float',fog.heightFalloff||0),
      uShadowEnabled:uniform('float',shadows?1:0),uShadowTexel:uniform('vec2',[1/shadowSize,1/shadowSize]),
      uShadowBias:uniform('float',light.shadowBias===undefined?Math.max(.00035,2.6*(2*extent/shadowSize)/(far-near)):light.shadowBias),
      uShadowSoftness:uniform('float',light.shadowSoftness===undefined?1.25:light.shadowSoftness),uShadowStrength:uniform('float',light.shadowStrength===undefined?1:clamp(light.shadowStrength,0,1))
    };
    var geometries={a3d_background:backgroundGeometry},opaque=[],transparent=[],shadowDraws=[];
    (scene.objects||[]).forEach(function(object,index) {
      if(!object||resolve(object.visible,time)===false)return;
      var geometry=resolve(object.geometry,time);if(!geometry)return;
      if(!geometry.id)geometry.id='a3d_g'+(++geometrySerial);
      geometries[geometry.id]=geometry;
      var material=resolve(object.material,time)||{},model=resolve(object.model,time)||compose({position:resolve(object.position,time)||[0,0,0],rotation:resolve(object.rotation,time)||[0,0,0],scale:resolve(object.scale,time)||[1,1,1]});
      var base=linearColor(material.color,'#c7c4bb'),emission=material.emission===undefined?[0,0,0]:(typeof material.emission==='number'?base.map(function(c){return c*material.emission;}):linearColor(material.emission));
      var opacity=material.opacity===undefined?1:clamp(material.opacity,0,1),clip=resolve(object.clipPlane,time)||material.clipPlane;
      var common={uModel:uniform('mat4',model),uClipPlane:uniform('vec4',clip||[0,1,0,0]),uClipEnabled:uniform('float',clip?1:0)};
      var uniforms=Object.assign({},common,{
        uNormalMatrix:uniform('mat3',normalMatrix(model)),uColor:uniform('vec3',base),uEmission:uniform('vec3',emission),
        uRoughness:uniform('float',material.roughness===undefined?.45:clamp(material.roughness,.055,1)),uMetalness:uniform('float',material.metalness===undefined?0:clamp(material.metalness,0,1)),
        uOpacity:uniform('float',opacity),uTexture:uniform('float',typeof material.texture==='number'?material.texture:(textureTypes[material.texture]||0)),
        uTextureScale:uniform('float',material.textureScale===undefined?1:material.textureScale),uTextureStrength:uniform('float',material.textureStrength===undefined?1:material.textureStrength),
        uUnlit:uniform('float',material.unlit?1:0),uAO:uniform('float',material.ao===undefined?1:clamp(material.ao,0,1)),uReceiveShadow:uniform('float',object.receiveShadow===false?0:1)
      });
      var draw={program:'main',geometry:geometry.id,label:object.name||object.id||('object_'+index),uniforms:uniforms,cullFace:object.doubleSided||material.doubleSided?null:'back'};
      if(opacity<1){draw.blend='alpha';draw.depthWrite=false;draw._distance=vec3.length(vec3.sub([model[12],model[13],model[14]],camera.eye));transparent.push(draw);}
      else opaque.push(draw);
      if(shadows&&object.castShadow!==false&&(opacity>=.95||object.castShadow===true))shadowDraws.push({program:'shadow',geometry:geometry.id,label:draw.label,uniforms:common,cullFace:draw.cullFace});
    });
    transparent.sort(function(a,b){return b._distance-a._distance;});transparent.forEach(function(d){delete d._distance;});
    var passes=[];
    if(shadows)passes.push({target:'a3d_shadow',clearColor:[1,1,1,1],clearDepth:1,depthTest:true,depthWrite:true,cullFace:'back',frontFace:'ccw',polygonOffset:{factor:1.5,units:2},uniforms:{uLightViewProjection:sceneUniforms.uLightViewProjection},draws:shadowDraws});
    var backgroundDraw={program:'background',geometry:'a3d_background',depthTest:false,depthWrite:false,cullFace:null,uniforms:{uResolution:uniform('vec2',[width,height]),uTop:uniform('vec3',top),uBottom:uniform('vec3',bottom),uVignette:uniform('float',bgObject?(background.vignette||0):0)}};
    passes.push({target:null,clearColor:bottom.concat(1),clearDepth:1,depthTest:true,depthWrite:true,cullFace:'back',frontFace:'ccw',uniforms:sceneUniforms,textures:{uShadowMap:'a3d_shadow'},draws:[backgroundDraw].concat(opaque,transparent)});
    return {schema:'native-scene-frame-v1',generator:'Atelier3D 1.0',width:width,height:height,glesVersion:2,scene:{camera:scene.camera||{},time:time,objectCount:opaque.length+transparent.length,shadowExtent:extent},programs:programs,geometries:geometries,textures:{a3d_shadow:shadows?{width:shadowSize,height:shadowSize,renderTarget:true,depthBuffer:true,minFilter:'nearest',magFilter:'nearest',wrapS:'clamp_to_edge',wrapT:'clamp_to_edge'}:{width:1,height:1,pixels:[255,255,255,255],minFilter:'nearest',magFilter:'nearest'}},passes:passes};
  }
  function inverseMatrix(m){
    var a=m.slice(),o=identity();for(var col=0;col<4;col++){
      var pivot=col;for(var r=col+1;r<4;r++)if(Math.abs(a[col*4+r])>Math.abs(a[col*4+pivot]))pivot=r;
      if(Math.abs(a[col*4+pivot])<1e-14)return identity();
      for(var c=0;c<4;c++){var t=a[c*4+col];a[c*4+col]=a[c*4+pivot];a[c*4+pivot]=t;t=o[c*4+col];o[c*4+col]=o[c*4+pivot];o[c*4+pivot]=t;}
      var div=a[col*4+col];for(var c=0;c<4;c++){a[c*4+col]/=div;o[c*4+col]/=div;}
      for(var r=0;r<4;r++)if(r!==col){var k=a[col*4+r];for(var c=0;c<4;c++){a[c*4+r]-=k*a[c*4+col];o[c*4+r]-=k*o[c*4+col];}}
    }return o;
  }
  var sourceFrame=frame;
  frame=function(scene,width,height,time){
    var settings=typeof globalThis!=='undefined'&&globalThis.AtelierDisplay||{},quality=settings.quality||'fine';
    var displayScene=Object.assign({},scene);
    displayScene.objects=scene.objects.map(function(o){if(!o.geometry||!o.geometry.boxSize||o.bevel===false||quality==='fast')return o;
      var matrix=o.model?o.model.slice():compose(o),scale=[0,1,2].map(function(k){return Math.hypot(matrix[k*4],matrix[k*4+1],matrix[k*4+2]);});
      if(scale.some(function(x){return x<1e-8;}))return o;
      var dims=o.geometry.boxSize.map(function(v,k){return v*scale[k];});
      var bevel=Math.min(.012,Math.min.apply(null,dims)*.045);
      if(bevel<.00001)return o;
      for(var k=0;k<3;k++)for(var r=0;r<3;r++)matrix[k*4+r]/=scale[k];
      // Do not round sheared transforms: the scientific shape must remain faithful.
      if(Math.abs(matrix[0]*matrix[4]+matrix[1]*matrix[5]+matrix[2]*matrix[6])>.0001)return o;
      return Object.assign({},o,{model:matrix,geometry:roundBox(dims[0],dims[1],dims[2],bevel)});
    });
    if(quality==='fast'&&scene.light)displayScene.light=Object.assign({},scene.light,{shadowSize:768});
    var packet=sourceFrame(displayScene,width,height,time),main=packet.passes.find(function(p){return p.target===null;}),vp=main.uniforms.uViewProjection.value;
    var enable=scene.contactShadows!==false&&quality!=='fast'&&(!scene.light||scene.light.shadows!==false),extent=packet.scene.shadowExtent||6;var depthScale=Math.min(1,1280/packet.width,960/packet.height);
    main.uniforms.uCameraVP=uniform('mat4',vp);main.uniforms.uInverseVP=uniform('mat4',inverseMatrix(vp));main.uniforms.uContactEnabled=uniform('float',enable?1:0);
    main.uniforms.uContactRadius=uniform('float',scene.contactRadius||Math.max(.018,extent*.030));main.uniforms.uContactStrength=uniform('float',scene.contactStrength===undefined?.68:scene.contactStrength);
    packet.textures.a3d_camera_depth=enable?{width:Math.max(1,Math.round(packet.width*depthScale)),height:Math.max(1,Math.round(packet.height*depthScale)),renderTarget:true,depthBuffer:true,minFilter:'nearest',magFilter:'nearest',wrapS:'clamp_to_edge',wrapT:'clamp_to_edge'}:{width:1,height:1,pixels:[255,255,255,255]};
    main.textures.uCameraDepth='a3d_camera_depth';
    if(enable)packet.passes.unshift({target:'a3d_camera_depth',clearColor:[1,1,1,1],clearDepth:1,depthTest:true,depthWrite:true,cullFace:'back',frontFace:'ccw',uniforms:{uLightViewProjection:uniform('mat4',vp)},draws:main.draws.filter(function(d){return d.program==='main'&&d.uniforms.uOpacity.value>=.98}).map(function(d){return {program:'shadow',geometry:d.geometry,cullFace:d.cullFace,uniforms:{uModel:d.uniforms.uModel,uClipPlane:d.uniforms.uClipPlane,uClipEnabled:d.uniforms.uClipEnabled}};})});
    packet.generator='Atelier3D 2.0 / v4 display pipeline';return packet;
  };
  var enumNames={triangles:'TRIANGLES',triangle_strip:'TRIANGLE_STRIP',triangle_fan:'TRIANGLE_FAN',lines:'LINES',line_strip:'LINE_STRIP',line_loop:'LINE_LOOP',points:'POINTS',back:'BACK',front:'FRONT',front_and_back:'FRONT_AND_BACK',cw:'CW',ccw:'CCW',nearest:'NEAREST',linear:'LINEAR',clamp_to_edge:'CLAMP_TO_EDGE',repeat:'REPEAT',mirrored_repeat:'MIRRORED_REPEAT',less:'LESS',lequal:'LEQUAL',always:'ALWAYS',zero:'ZERO',one:'ONE',src_alpha:'SRC_ALPHA',one_minus_src_alpha:'ONE_MINUS_SRC_ALPHA',dst_alpha:'DST_ALPHA',one_minus_dst_alpha:'ONE_MINUS_DST_ALPHA'};
  function Renderer(canvas,options) {
    if(!canvas||typeof canvas.getContext!=='function')throw new Error('Renderer needs a canvas.');
    this.canvas=canvas;this.options=options||{};
    this.gl=canvas.getContext('webgl',{alpha:false,antialias:this.options.antialias!==false,premultipliedAlpha:false,preserveDrawingBuffer:!!this.options.preserveDrawingBuffer});
    if(!this.gl)throw new Error('WebGL is unavailable in this browser or device.');
    this.programs={};this.geometries={};this.textures={};this.enabledAttributes=[];this.lastFrame=null;
  }
  Renderer.prototype._enum=function(name){return this.gl[enumNames[name]||name];};
  Renderer.prototype._program=function(id,spec) {
    var gl=this.gl,existing=this.programs[id];if(existing&&existing.vertex===spec.vertex&&existing.fragment===spec.fragment)return existing;
    if(existing)gl.deleteProgram(existing.handle);
    function compile(type,source){var s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){var message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error('Atelier3D shader compilation failed: '+message);}return s;}
    var vertex=compile(gl.VERTEX_SHADER,spec.vertex),fragment=compile(gl.FRAGMENT_SHADER,spec.fragment),program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Atelier3D shader link failed: '+gl.getProgramInfoLog(program));
    var out={handle:program,vertex:spec.vertex,fragment:spec.fragment,uniforms:{},attributes:{}};this.programs[id]=out;return out;
  };
  Renderer.prototype._geometry=function(id,spec) {
    var gl=this.gl,old=this.geometries[id];if(old&&old.source===spec&&old.version===(spec.version||0))return old;
    if(old){Object.keys(old.attributes).forEach(function(k){gl.deleteBuffer(old.attributes[k].buffer);});if(old.indexBuffer)gl.deleteBuffer(old.indexBuffer);}
    var out={source:spec,version:spec.version||0,attributes:{},count:0,indexBuffer:null};
    Object.keys(spec.attributes).forEach(function(name){var attribute=spec.attributes[name],buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(attribute.data),gl.STATIC_DRAW);out.attributes[name]={buffer:buffer,size:attribute.size};out.count=attribute.data.length/attribute.size;});
    if(spec.indices!==undefined&&spec.indices!==null){if(spec.indexType&&spec.indexType!=='uint16')throw new Error('Atelier3D browser renderer supports uint16 indices.');var indices=Array.isArray(spec.indices)||ArrayBuffer.isView(spec.indices)?spec.indices:spec.indices.data;out.indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,out.indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);out.count=indices.length;}
    this.geometries[id]=out;return out;
  };
  Renderer.prototype._texture=function(id,spec) {
    var pixelKey=spec.pixels&&spec.pixels.length<=64?Array.from(spec.pixels).join(','):null;
    var gl=this.gl,key=[spec.width,spec.height,spec.renderTarget,spec.depthBuffer,spec.minFilter,spec.magFilter,spec.wrapS,spec.wrapT,spec.version||0,pixelKey].join('|'),old=this.textures[id],self=this;
    if(old&&old.key===key&&(!spec.pixels||old.pixels===spec.pixels||pixelKey!==null))return old;
    if(old){gl.deleteTexture(old.texture);if(old.framebuffer)gl.deleteFramebuffer(old.framebuffer);if(old.depthBuffer)gl.deleteRenderbuffer(old.depthBuffer);}
    var texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    [[gl.TEXTURE_MIN_FILTER,spec.minFilter||'nearest'],[gl.TEXTURE_MAG_FILTER,spec.magFilter||'nearest'],[gl.TEXTURE_WRAP_S,spec.wrapS||'clamp_to_edge'],[gl.TEXTURE_WRAP_T,spec.wrapT||'clamp_to_edge']].forEach(function(pair){gl.texParameteri(gl.TEXTURE_2D,pair[0],self._enum(pair[1]));});
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,spec.width,spec.height,0,gl.RGBA,gl.UNSIGNED_BYTE,spec.pixels?new Uint8Array(spec.pixels):null);
    var out={texture:texture,framebuffer:null,depthBuffer:null,width:spec.width,height:spec.height,key:key,pixels:spec.pixels};
    if(spec.renderTarget){out.framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,out.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);if(spec.depthBuffer!==false){out.depthBuffer=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,out.depthBuffer);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,spec.width,spec.height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,out.depthBuffer);}if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Atelier3D framebuffer is incomplete.');}
    this.textures[id]=out;return out;
  };
  Renderer.prototype._uniform=function(program,name,spec) {
    var gl=this.gl,loc;if(Object.prototype.hasOwnProperty.call(program.uniforms,name))loc=program.uniforms[name];else{loc=gl.getUniformLocation(program.handle,name);program.uniforms[name]=loc;}
    if(loc===null)return;var type=spec.type,v=spec.value;
    if(type==='float'||type==='1f')gl.uniform1f(loc,v);
    else if(type==='int'||type==='bool'||type==='sampler2D'||type==='1i')gl.uniform1i(loc,v);
    else if(type==='vec2')gl.uniform2fv(loc,v);
    else if(type==='vec3')gl.uniform3fv(loc,v);
    else if(type==='vec4')gl.uniform4fv(loc,v);
    else if(type==='mat3')gl.uniformMatrix3fv(loc,false,v);
    else if(type==='mat4')gl.uniformMatrix4fv(loc,false,v);
    else if(type==='float[]')gl.uniform1fv(loc,v);
    else if(type==='vec2[]')gl.uniform2fv(loc,v);
    else if(type==='vec3[]')gl.uniform3fv(loc,v);
    else if(type==='vec4[]')gl.uniform4fv(loc,v);
    else throw new Error('Unsupported frame uniform type: '+type);
  };
  Renderer.prototype._state=function(spec) {
    var gl=this.gl,self=this;function enabled(cap,yes){if(yes)gl.enable(cap);else gl.disable(cap);}
    enabled(gl.DEPTH_TEST,spec.depthTest!==false);gl.depthFunc(this._enum(spec.depthFunc||'less'));gl.depthMask(spec.depthWrite!==false);
    enabled(gl.CULL_FACE,!!spec.cullFace);if(spec.cullFace)gl.cullFace(this._enum(spec.cullFace));gl.frontFace(this._enum(spec.frontFace||'ccw'));
    enabled(gl.BLEND,!!spec.blend);if(spec.blend==='alpha')gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);else if(spec.blend==='additive')gl.blendFunc(gl.SRC_ALPHA,gl.ONE);else if(spec.blend&&typeof spec.blend==='object')gl.blendFunc(this._enum(spec.blend.src||'src_alpha'),this._enum(spec.blend.dst||'one_minus_src_alpha'));
    enabled(gl.POLYGON_OFFSET_FILL,!!spec.polygonOffset);if(spec.polygonOffset)gl.polygonOffset(spec.polygonOffset.factor||0,spec.polygonOffset.units||0);
    gl.lineWidth(spec.lineWidth||1);var mask=spec.colorMask||[true,true,true,true];gl.colorMask(mask[0],mask[1],mask[2],mask[3]);
  };
  Renderer.prototype._prune=function(packet) {
    var gl=this.gl,self=this;
    Object.keys(this.geometries).forEach(function(id){if(Object.prototype.hasOwnProperty.call(packet.geometries,id))return;var geometry=self.geometries[id];Object.keys(geometry.attributes).forEach(function(name){gl.deleteBuffer(geometry.attributes[name].buffer);});if(geometry.indexBuffer)gl.deleteBuffer(geometry.indexBuffer);delete self.geometries[id];});
    Object.keys(this.textures).forEach(function(id){if(packet.textures&&Object.prototype.hasOwnProperty.call(packet.textures,id))return;var texture=self.textures[id];gl.deleteTexture(texture.texture);if(texture.framebuffer)gl.deleteFramebuffer(texture.framebuffer);if(texture.depthBuffer)gl.deleteRenderbuffer(texture.depthBuffer);delete self.textures[id];});
    Object.keys(this.programs).forEach(function(id){if(Object.prototype.hasOwnProperty.call(packet.programs,id))return;gl.deleteProgram(self.programs[id].handle);delete self.programs[id];});
  };
  Renderer.prototype.drawFrame=function(packet) {
    var gl=this.gl,self=this;if(this.canvas.width!==packet.width)this.canvas.width=packet.width;if(this.canvas.height!==packet.height)this.canvas.height=packet.height;
    Object.keys(packet.programs).forEach(function(id){self._program(id,packet.programs[id]);});
    Object.keys(packet.geometries).forEach(function(id){self._geometry(id,packet.geometries[id]);});
    Object.keys(packet.textures||{}).forEach(function(id){self._texture(id,packet.textures[id]);});
    this._prune(packet);
    packet.passes.forEach(function(pass){
      var target=pass.target?self.textures[pass.target]:null;gl.bindFramebuffer(gl.FRAMEBUFFER,target?target.framebuffer:null);
      var viewport=pass.viewport||[0,0,target?target.width:packet.width,target?target.height:packet.height];gl.viewport(viewport[0],viewport[1],viewport[2],viewport[3]);
      self._state(pass);var mask=0;
      if(pass.clearColor){gl.clearColor(pass.clearColor[0],pass.clearColor[1],pass.clearColor[2],pass.clearColor[3]);mask|=gl.COLOR_BUFFER_BIT;}
      if(pass.clearDepth!==false){gl.clearDepth(pass.clearDepth===undefined?1:pass.clearDepth);mask|=gl.DEPTH_BUFFER_BIT;}if(mask)gl.clear(mask);
      (pass.draws||[]).forEach(function(draw){
        var program=self.programs[draw.program],geometry=self.geometries[draw.geometry],state=Object.assign({},pass,draw);self._state(state);gl.useProgram(program.handle);
        var uniforms=Object.assign({},pass.uniforms||{},draw.uniforms||{});Object.keys(uniforms).forEach(function(name){self._uniform(program,name,uniforms[name]);});
        var textures=Object.assign({},pass.textures||{},draw.textures||{});Object.keys(textures).forEach(function(name,unit){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,self.textures[textures[name]].texture);self._uniform(program,name,{type:'sampler2D',value:unit});});
        self.enabledAttributes.forEach(function(location){gl.disableVertexAttribArray(location);});self.enabledAttributes=[];
        Object.keys(geometry.attributes).forEach(function(name){var loc;if(Object.prototype.hasOwnProperty.call(program.attributes,name))loc=program.attributes[name];else{loc=gl.getAttribLocation(program.handle,name);program.attributes[name]=loc;}if(loc<0)return;var attr=geometry.attributes[name];gl.bindBuffer(gl.ARRAY_BUFFER,attr.buffer);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,attr.size,gl.FLOAT,false,0,0);self.enabledAttributes.push(loc);});
        var mode=self._enum(draw.mode||'triangles'),count=draw.count===undefined?geometry.count:draw.count,first=draw.first||0;
        if(geometry.indexBuffer){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,geometry.indexBuffer);gl.drawElements(mode,count,gl.UNSIGNED_SHORT,first*2);}else gl.drawArrays(mode,first,count);
      });
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.lastFrame=packet;return packet;
  };
  Renderer.prototype.resize=function(width,height,pixelRatio) {
    var ratio=pixelRatio===undefined?1:pixelRatio;this.canvas.width=Math.max(1,Math.round(width*ratio));this.canvas.height=Math.max(1,Math.round(height*ratio));this._manualSize=true;return this;
  };
  Renderer.prototype.render=function(scene,time) {
    if(!this._manualSize&&this.options.autoResize!==false){var ratio=this.options.pixelRatio===undefined?Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,2):this.options.pixelRatio,w=Math.round((this.canvas.clientWidth||this.canvas.width)*ratio),h=Math.round((this.canvas.clientHeight||this.canvas.height)*ratio);if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;}
    return this.drawFrame(frame(scene,this.canvas.width,this.canvas.height,time));
  };
  Renderer.prototype.dispose=function() {
    var gl=this.gl;Object.values(this.programs).forEach(function(p){gl.deleteProgram(p.handle);});Object.values(this.geometries).forEach(function(g){Object.values(g.attributes).forEach(function(a){gl.deleteBuffer(a.buffer);});if(g.indexBuffer)gl.deleteBuffer(g.indexBuffer);});Object.values(this.textures).forEach(function(t){gl.deleteTexture(t.texture);if(t.framebuffer)gl.deleteFramebuffer(t.framebuffer);if(t.depthBuffer)gl.deleteRenderbuffer(t.depthBuffer);});this.programs={};this.geometries={};this.textures={};this.lastFrame=null;
  };
  function Orbit(canvas,camera,options) {
    if(!canvas||!camera)throw new Error('Orbit needs a canvas and a mutable camera object.');
    this.canvas=canvas;this.camera=camera;this.options=options||{};this.initial={position:(camera.position||camera.eye||[6,4,7]).slice(),target:(camera.target||[0,0,0]).slice(),ortho:camera.ortho};
    camera.position=this.initial.position.slice();camera.target=this.initial.target.slice();this.pointers=new Map();this.listeners=[];this.sync();
    var self=this;
    function listen(type,fn,opts){canvas.addEventListener(type,fn,opts);self.listeners.push([type,fn,opts]);}
    if(canvas.style)canvas.style.touchAction='none';
    listen('pointerdown',function(e){if(e.button!==undefined&&e.button>2)return;self.dragPan=e.button===1||e.button===2||e.shiftKey;self.pointers.set(e.pointerId,[e.clientX,e.clientY]);if(canvas.setPointerCapture)canvas.setPointerCapture(e.pointerId);});
    listen('pointermove',function(e){if(!self.pointers.has(e.pointerId))return;var prev=self.pointers.get(e.pointerId),before=Array.from(self.pointers.values());self.pointers.set(e.pointerId,[e.clientX,e.clientY]);var after=Array.from(self.pointers.values());if(after.length>1){var oldDistance=Math.hypot(before[0][0]-before[1][0],before[0][1]-before[1][1]),newDistance=Math.hypot(after[0][0]-after[1][0],after[0][1]-after[1][1]);if(newDistance>1&&oldDistance>1)self.zoom(oldDistance/newDistance);self.pan((after[0][0]+after[1][0]-before[0][0]-before[1][0])*.5,(after[0][1]+after[1][1]-before[0][1]-before[1][1])*.5);}else if(self.dragPan)self.pan(e.clientX-prev[0],e.clientY-prev[1]);else self.rotate(-(e.clientX-prev[0])*.006*(self.options.rotateSpeed||1),-(e.clientY-prev[1])*.006*(self.options.rotateSpeed||1));});
    function release(e){self.pointers.delete(e.pointerId);}listen('pointerup',release);listen('pointercancel',release);listen('lostpointercapture',release);
    listen('contextmenu',function(e){e.preventDefault();});listen('wheel',function(e){e.preventDefault();self.zoom(Math.exp(clamp(e.deltaY,-120,120)*.0015*(self.options.zoomSpeed||1)));},{passive:false});
  }
  Orbit.prototype.sync=function(){var d=vec3.sub(this.camera.position,this.camera.target);this.radius=Math.max(1e-6,vec3.length(d));this.theta=Math.atan2(d[0],d[2]);this.phi=Math.acos(clamp(d[1]/this.radius,-1,1));return this;};
  Orbit.prototype._update=function(){this.phi=clamp(this.phi,this.options.minPhi===undefined?.06:this.options.minPhi,this.options.maxPhi===undefined?Math.PI-.06:this.options.maxPhi);this.radius=clamp(this.radius,this.options.minDistance===undefined?.5:this.options.minDistance,this.options.maxDistance===undefined?150:this.options.maxDistance);var sin=Math.sin(this.phi),offset=[this.radius*sin*Math.sin(this.theta),this.radius*Math.cos(this.phi),this.radius*sin*Math.cos(this.theta)];this.camera.position=vec3.add(this.camera.target,offset);if(this.options.onChange)this.options.onChange(this.camera);return this;};
  Orbit.prototype.rotate=function(yaw,pitch){this.theta+=yaw;this.phi+=pitch||0;return this._update();};
  Orbit.prototype.zoom=function(factor){if(this.camera.ortho&&typeof this.camera.ortho==='number')this.camera.ortho=clamp(this.camera.ortho*factor,.1,1000);else this.radius*=factor;return this._update();};
  Orbit.prototype.pan=function(dx,dy){var f=vec3.normalize(vec3.sub(this.camera.target,this.camera.position)),r=vec3.normalize(vec3.cross(f,[0,1,0])),u=vec3.normalize(vec3.cross(r,f)),scale=(this.camera.ortho||2*this.radius*Math.tan((this.camera.fov||45)*Math.PI/360))/Math.max(1,this.canvas.clientHeight||this.canvas.height),delta=vec3.add(vec3.scale(r,-dx*scale),vec3.scale(u,dy*scale));this.camera.target=vec3.add(this.camera.target,delta);return this._update();};
  Orbit.prototype.reset=function(){this.camera.position=this.initial.position.slice();this.camera.target=this.initial.target.slice();this.camera.ortho=this.initial.ortho;this.sync();return this._update();};
  Orbit.prototype.dispose=function(){var canvas=this.canvas;this.listeners.forEach(function(entry){canvas.removeEventListener(entry[0],entry[1],entry[2]);});this.listeners=[];this.pointers.clear();};
  return {version:'2.0.0',Scene:Scene,Renderer:Renderer,Orbit:Orbit,frame:frame,programs:programs,box:box,roundBox:roundBox,inverseMatrix:inverseMatrix,plane:plane,sphere:sphere,cylinder:cylinder,torus:torus,lathe:lathe,tube:tube,triangles:triangles,touch:touch,compose:compose,project:project,cameraMatrices:cameraMatrices,color:color,linearColor:linearColor,vec3:vec3,clamp:clamp,mat4:{identity:identity,multiply:multiply,translation:translation,scaling:scaling,rotationX:rotationX,rotationY:rotationY,rotationZ:rotationZ,lookAt:lookAt,perspective:perspective,orthographic:orthographic,normalMatrix:normalMatrix,transformPoint:transformPoint},TAU:TAU};
});

